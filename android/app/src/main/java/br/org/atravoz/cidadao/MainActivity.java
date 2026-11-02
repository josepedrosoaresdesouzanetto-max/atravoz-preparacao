package br.org.atravoz.cidadao;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(android.os.Bundle state) {
        registerPlugin(ProximityPlugin.class);
        super.onCreate(state);
    }
}
