package ar.walletpath.widget;

import android.app.Activity;
import android.os.Bundle;
import android.util.TypedValue;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.Switch;
import android.widget.TextView;

/**
 * Pantalla de la app: elige qué billeteras muestra el widget (igual que el selector de la web,
 * pero guardado en el celular) y explica cómo agregar el widget.
 * Al cambiar un interruptor el widget se redibuja enseguida con el último JSON descargado.
 */
public class MainActivity extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        LinearLayout col = new LinearLayout(this);
        col.setOrientation(LinearLayout.VERTICAL);
        int pad = dp(24);
        col.setPadding(pad, pad, pad, pad);

        TextView title = new TextView(this);
        title.setText("Billeteras en el widget");
        title.setTextSize(22);
        title.setTypeface(title.getTypeface(), android.graphics.Typeface.BOLD);
        col.addView(title);

        TextView sub = new TextView(this);
        sub.setText("Las que destildes no aparecen en el top de tasas ni compiten por la mejor ruta. "
                + "Es independiente de la selección de la web.");
        sub.setTextSize(14);
        sub.setAlpha(0.7f);
        sub.setPadding(0, dp(6), 0, dp(12));
        col.addView(sub);

        for (int i = 0; i < RatesWidget.WALLET_IDS.length; i++) {
            final String id = RatesWidget.WALLET_IDS[i];
            Switch s = new Switch(this);
            s.setText(RatesWidget.WALLET_LABELS[i]);
            s.setTextSize(17);
            s.setPadding(0, dp(12), 0, dp(12));
            s.setChecked(RatesWidget.isEnabled(this, id));
            s.setOnCheckedChangeListener((btn, on) -> {
                RatesWidget.setEnabled(this, id, on);
                RatesWidget.rerenderFromCache(getApplicationContext());
            });
            col.addView(s);
        }

        TextView help = new TextView(this);
        help.setText("Para usar el widget: mantené apretada la pantalla de inicio → Widgets → "
                + "Wallet Path → \"Tasas USD → ARS\".\n\nTocá el encabezado del widget para actualizarlo; "
                + "el resto abre la web.");
        help.setTextSize(15);
        help.setAlpha(0.8f);
        help.setPadding(0, dp(28), 0, 0);
        col.addView(help);

        ScrollView scroll = new ScrollView(this);
        scroll.addView(col);
        setContentView(scroll);
    }

    private int dp(int v) {
        return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics());
    }
}
