package br.org.atravoz.cidadao;
import org.junit.Test;
import static org.junit.Assert.*;
import java.io.*;

public class RadioFramesTest {
    @Test public void roundtripUnicode() throws Exception {ByteArrayOutputStream b=new ByteArrayOutputStream();RadioFrames.write(b,"água 🌊");assertEquals("água 🌊",RadioFrames.read(new ByteArrayInputStream(b.toByteArray())));}
    @Test(expected=IOException.class) public void oversizedIncoming() throws Exception {ByteArrayOutputStream b=new ByteArrayOutputStream();new DataOutputStream(b).writeInt(1000000);RadioFrames.read(new ByteArrayInputStream(b.toByteArray()));}
    @Test(expected=IOException.class) public void negativeLength() throws Exception {RadioFrames.read(new ByteArrayInputStream(new byte[]{-1,-1,-1,-1}));}
    @Test(expected=IOException.class) public void incompleteNeverAccepted() throws Exception {ByteArrayOutputStream b=new ByteArrayOutputStream();new DataOutputStream(b).writeInt(20);b.write(1);RadioFrames.read(new ByteArrayInputStream(b.toByteArray()));}
    @Test(expected=IOException.class) public void invalidUtf8() throws Exception {RadioFrames.read(new ByteArrayInputStream(new byte[]{0,0,0,1,(byte)255}));}
    @Test(expected=IOException.class) public void oversizedOutgoing() throws Exception {RadioFrames.write(new ByteArrayOutputStream(),new String(new char[20000]).replace('\0','x'));}
}
