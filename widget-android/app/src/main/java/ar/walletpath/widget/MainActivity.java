package ar.walletpath.widget;

import android.app.Activity;
import android.os.Bundle;
import android.view.Gravity;
import android.widget.TextView;

/** Pantalla mínima: la app es solo el widget. */
public class MainActivity extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        TextView t = new TextView(this);
        t.setGravity(Gravity.CENTER);
        t.setPadding(64, 64, 64, 64);
        t.setTextSize(18);
        t.setText("Listo.\n\nPara usar el widget: mantené apretada la pantalla de inicio → Widgets → "
                + "Wallet Path → \"Tasas USD → ARS\".\n\nTocá el encabezado del widget para actualizarlo; "
                + "el resto abre la web.");
        setContentView(t);
    }
}
