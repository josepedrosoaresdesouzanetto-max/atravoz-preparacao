package br.org.atravoz.cidadao;

import java.io.*;
import java.nio.ByteBuffer;
import java.nio.charset.*;

/** Length-prefixed UTF-8 framing. No incident plaintext or cryptographic keys here. */
public final class RadioFrames {
    public static final int MAX_BYTES = 16384;
    public static String read(InputStream input) throws IOException {
        DataInputStream stream = new DataInputStream(input);
        int length = stream.readInt();
        if (length < 1 || length > MAX_BYTES) throw new IOException("FRAME_LIMIT");
        byte[] data = new byte[length];
        stream.readFully(data);
        try { return StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(data)).toString(); }
        catch (CharacterCodingException e) { throw new IOException("FRAME_ENCODING"); }
    }
    public static void write(OutputStream output, String value) throws IOException {
        byte[] data = value.getBytes(StandardCharsets.UTF_8);
        if (data.length < 1 || data.length > MAX_BYTES) throw new IOException("FRAME_LIMIT");
        DataOutputStream stream = new DataOutputStream(output);
        stream.writeInt(data.length); stream.write(data); stream.flush();
    }
}
