package br.org.atravoz.cidadao;

import android.Manifest;
import android.app.Activity;
import android.bluetooth.*;
import android.content.*;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import androidx.activity.result.ActivityResult;
import androidx.core.content.FileProvider;
import com.getcapacitor.*;
import com.getcapacitor.annotation.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

@CapacitorPlugin(name="AtravozProximity", permissions={
    @Permission(alias="nearby",strings={Manifest.permission.BLUETOOTH_SCAN,Manifest.permission.BLUETOOTH_CONNECT,Manifest.permission.BLUETOOTH_ADVERTISE}),
    @Permission(alias="legacyDiscovery",strings={Manifest.permission.ACCESS_FINE_LOCATION})
})
public class ProximityPlugin extends Plugin {
    private static final UUID SERVICE = UUID.fromString("aef0940d-284c-4cb9-8713-414e54454e41");
    private final ExecutorService workers = Executors.newFixedThreadPool(3);
    private final Handler timer = new Handler(Looper.getMainLooper());
    private final AtomicInteger pendingWrites = new AtomicInteger();
    private volatile BluetoothSocket socket;
    private volatile BluetoothServerSocket server;
    private volatile boolean active = false;
    private volatile int generation = 0;
    private boolean receiverRegistered = false;
    private int discovered = 0;
    private BluetoothAdapter adapter() {
        BluetoothManager manager = getContext().getSystemService(BluetoothManager.class);
        return manager == null ? null : manager.getAdapter();
    }
    private String permissionAlias() { return Build.VERSION.SDK_INT >= 31 ? "nearby" : "legacyDiscovery"; }
    private boolean allowed(PluginCall call) {
        if (getPermissionState(permissionAlias()) != PermissionState.GRANTED) { call.reject("Permissão de proximidade necessária.","RADIO_PERMISSION"); return false; }
        BluetoothAdapter a = adapter();
        if (a == null || !a.isEnabled()) { call.reject("Ative o Bluetooth nas configurações do Android.","RADIO_DISABLED"); return false; }
        return true;
    }
    private void event(String type, String code) { JSObject value=new JSObject();value.put("type",type);value.put("code",code);notifyListeners("radio",value); }
    private final BroadcastReceiver receiver = new BroadcastReceiver() {
        @Override public void onReceive(Context context, Intent intent) {
            if (BluetoothDevice.ACTION_FOUND.equals(intent.getAction()) && discovered < 30) {
                BluetoothDevice d=intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE);
                if (d != null) { discovered++;JSObject value=new JSObject();value.put("type","device");value.put("address",d.getAddress());String name=d.getName();value.put("name",name==null?"Android próximo":name.substring(0,Math.min(60,name.length())));notifyListeners("radio",value); }
            } else if (BluetoothAdapter.ACTION_DISCOVERY_FINISHED.equals(intent.getAction())) event("discoveryFinished","DISCOVERY_FINISHED");
        }
    };
    @Override public void load() {
        IntentFilter filter=new IntentFilter();filter.addAction(BluetoothDevice.ACTION_FOUND);filter.addAction(BluetoothAdapter.ACTION_DISCOVERY_FINISHED);
        // Bluetooth broadcasts originate from the system Bluetooth service, outside this app UID.
        if (Build.VERSION.SDK_INT>=33)getContext().registerReceiver(receiver,filter,Context.RECEIVER_EXPORTED);
        else getContext().registerReceiver(receiver,filter);
        receiverRegistered=true;
    }
    @PluginMethod public void capabilities(PluginCall call) {
        JSObject result=new JSObject();result.put("supported",adapter()!=null);result.put("transport","bluetooth-classic-rfcomm");result.put("foregroundOnly",true);result.put("sdk",Build.VERSION.SDK_INT);result.put("model",Build.MODEL);call.resolve(result);
    }
    @PluginMethod public void authorize(PluginCall call) { requestPermissionForAlias(permissionAlias(),call,"permissionResult"); }
    @PermissionCallback private void permissionResult(PluginCall call) {
        JSObject result=new JSObject();result.put("granted",getPermissionState(permissionAlias())==PermissionState.GRANTED);call.resolve(result);
    }
    @PluginMethod public void discover(PluginCall call) {
        if(!allowed(call))return;
        try {
            BluetoothAdapter a=adapter();if(socket!=null){call.reject("Encerre a conexão antes de procurar.","RADIO_BUSY");return;}
            a.cancelDiscovery();discovered=0;
            for(BluetoothDevice d:a.getBondedDevices()) { if(discovered++>=30)break;JSObject v=new JSObject();v.put("type","device");v.put("address",d.getAddress());v.put("name",d.getName()==null?"Aparelho pareado":d.getName());notifyListeners("radio",v); }
            if(!a.startDiscovery()){call.reject("Descoberta não iniciada.","DISCOVERY_FAILED");return;}
            timer.postDelayed(()->{try{a.cancelDiscovery();}catch(Exception ignored){}},15000);call.resolve();
        } catch(Exception e){call.reject("Descoberta indisponível.","DISCOVERY_FAILED");}
    }
    @PluginMethod public void listen(PluginCall call) {
        if(!allowed(call))return;
        Intent intent=new Intent(BluetoothAdapter.ACTION_REQUEST_DISCOVERABLE);intent.putExtra(BluetoothAdapter.EXTRA_DISCOVERABLE_DURATION,120);
        startActivityForResult(call,intent,"discoverableResult");
    }
    @ActivityCallback private void discoverableResult(PluginCall call,ActivityResult result) {
        if(call==null)return;
        if(result.getResultCode()==Activity.RESULT_CANCELED){call.reject("Visibilidade recusada.","RADIO_PERMISSION");return;}
        stopRadio();active=true;final int epoch=generation;
        workers.execute(()->{
            boolean notified=false;
            try {BluetoothServerSocket listener=adapter().listenUsingRfcommWithServiceRecord("ATRAVOZ",SERVICE);server=listener;call.resolve();notified=true;event("listening","RADIO_LISTENING");BluetoothSocket accepted=listener.accept(120000);listener.close();if(server==listener)server=null;if(!active||epoch!=generation){accepted.close();return;}connected(accepted,epoch);}
            catch(Exception e){if(!notified)call.reject("Não foi possível aguardar conexão.","RADIO_LISTEN_FAILED");if(epoch==generation){event("error","RADIO_LISTEN_FAILED");stopRadio();}}
        });
    }
    @PluginMethod public void connect(PluginCall call) {
        if(!allowed(call))return;
        String address=call.getString("address","");if(!BluetoothAdapter.checkBluetoothAddress(address)){call.reject("Aparelho inválido.","RADIO_DEVICE");return;}
        stopRadio();active=true;final int epoch=generation;
        workers.execute(()->{
            try {adapter().cancelDiscovery();BluetoothSocket candidate=adapter().getRemoteDevice(address).createRfcommSocketToServiceRecord(SERVICE);socket=candidate;
                timer.postDelayed(()->{if(epoch==generation&&active&&socket==candidate&&!candidate.isConnected())stopRadio();},20000);
                candidate.connect();if(!active||epoch!=generation){candidate.close();call.reject("Conexão cancelada.","RADIO_CLOSED");return;}call.resolve();connected(candidate,epoch);
            }catch(Exception e){call.reject("Conexão Bluetooth não concluída.","RADIO_CONNECT_FAILED");if(epoch==generation){event("error","RADIO_CONNECT_FAILED");stopRadio();}}
        });
    }
    private void connected(BluetoothSocket current,int epoch) throws IOException {
        synchronized(this){if(epoch!=generation||!active){current.close();return;}socket=current;}
        event("connected","RADIO_CONNECTED");timer.postDelayed(()->{if(epoch==generation)stopRadio();},300000);
        long window=System.currentTimeMillis();int frames=0;
        while(active&&epoch==generation&&socket==current){
            String data=RadioFrames.read(current.getInputStream());
            long now=System.currentTimeMillis();if(now-window>=1000){window=now;frames=0;}
            if(++frames>100)throw new IOException("RATE_LIMIT");
            JSObject value=new JSObject();value.put("type","frame");value.put("data",data);notifyListeners("radio",value);
        }
    }
    @PluginMethod public void send(PluginCall call) {
        String data=call.getString("data","");BluetoothSocket current=socket;
        if(current==null||!active||data.getBytes(StandardCharsets.UTF_8).length>RadioFrames.MAX_BYTES){call.reject("Canal indisponível ou pacote excedido.","RADIO_SEND_FAILED");return;}
        if(pendingWrites.incrementAndGet()>16){pendingWrites.decrementAndGet();call.reject("Fila de rádio cheia.","RADIO_LIMIT");return;}
        workers.execute(()->{try{synchronized(current){RadioFrames.write(current.getOutputStream(),data);}call.resolve();}catch(Exception e){call.reject("Transferência interrompida.","RADIO_SEND_FAILED");stopRadio();}finally{pendingWrites.decrementAndGet();}});
    }
    private synchronized void stopRadio() {
        boolean was=active;active=false;generation++;timer.removeCallbacksAndMessages(null);
        try{if(adapter()!=null)adapter().cancelDiscovery();}catch(Exception ignored){}
        try{if(server!=null)server.close();}catch(Exception ignored){}server=null;
        try{if(socket!=null)socket.close();}catch(Exception ignored){}socket=null;
        if(was)event("closed","RADIO_CLOSED");
    }
    @PluginMethod public void stop(PluginCall call){stopRadio();call.resolve();}
    @PluginMethod public void exportDiagnostic(PluginCall call){
        String data=call.getString("data","");String format=call.getString("format","json");
        if(!format.equals("json")&&!format.equals("md")||data.getBytes(StandardCharsets.UTF_8).length>262144){call.reject("Exportação acima do limite.","EXPORT_LIMIT");return;}
        try {File directory=new File(getContext().getCacheDir(),"diagnostics");directory.mkdirs();File file=new File(directory,"ATRAVOZ-diagnostico."+format);
            try(FileOutputStream stream=new FileOutputStream(file)){stream.write(data.getBytes(StandardCharsets.UTF_8));}
            Intent intent=new Intent(Intent.ACTION_SEND);intent.setType(format.equals("json")?"application/json":"text/markdown");intent.putExtra(Intent.EXTRA_STREAM,FileProvider.getUriForFile(getContext(),getContext().getPackageName()+".fileprovider",file));intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getActivity().startActivity(Intent.createChooser(intent,"Compartilhar diagnóstico revisado"));call.resolve();
        }catch(Exception e){call.reject("Não foi possível exportar.","EXPORT_FAILED");}
    }
    @Override protected void handleOnStop(){stopRadio();}
    @Override protected void handleOnDestroy(){stopRadio();workers.shutdownNow();if(receiverRegistered){getContext().unregisterReceiver(receiver);receiverRegistered=false;}}
}
