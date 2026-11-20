package ar.walletpath.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/**
 * Widget 4×2: top 3 de tasas USD→ARS y mejor ruta. Lee el widget.json que genera la
 * GitHub Action del repo (mismo código que la web). No calcula nada: dibuja textos ya
 * formateados. Si el JSON trae `wallets` y `routes`, filtra según las billeteras tildadas
 * en la app (MainActivity); si no, dibuja `display` tal cual.
 *
 * Sin valores inventados: si la descarga falla se muestra el último JSON bueno con un
 * aviso en rojo, o "Sin datos" si nunca se descargó.
 */
public class RatesWidget extends AppWidgetProvider {

    static final String JSON_URL =
            "https://raw.githubusercontent.com/Ignacio-81/commission-tracker/widget-json/widget.json";
    static final String WEB_URL = "https://ignacio-81.github.io/commission-tracker/";
    static final String ACTION_REFRESH = "ar.walletpath.widget.REFRESH";

    private static final String PREFS = "widget";
    private static final String KEY_JSON = "last_json";

    private static final int WHITE = 0xFFFFFFFF;
    private static final int DIM = 0xB3FFFFFF;
    private static final int GREEN = 0xFF4ADE80;
    private static final int RED = 0xFFFCA5A5;

    private static final int[] RANK = {R.id.rank1, R.id.rank2, R.id.rank3};
    private static final int[] NAME = {R.id.name1, R.id.name2, R.id.name3};
    private static final int[] VALUE = {R.id.value1, R.id.value2, R.id.value3};

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        refreshAsync(context);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        if (ACTION_REFRESH.equals(intent.getAction())) refreshAsync(context);
    }

    /** Descarga en un hilo aparte (no se permite red en el hilo principal). */
    private void refreshAsync(Context context) {
        final PendingResult pending = goAsync();
        final Context app = context.getApplicationContext();
        new Thread(() -> {
            try {
                String json = null;
                try {
                    json = fetchAndStore(app);
                } catch (Exception e) {
                    json = null;
                }
                render(app, json != null ? json : prefs(app).getString(KEY_JSON, null), json == null);
            } finally {
                pending.finish();
            }
        }).start();
    }

    static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    // ── Selección de billeteras (se elige en MainActivity; todas tildadas por defecto) ──
    // Mismos ids que la web (commission-tracker-app/src/lib/wallets.ts) y que widget.json.
    static final String[] WALLET_IDS = {"astropay", "belo", "takenos", "santander", "binance"};
    static final String[] WALLET_LABELS = {"AstroPay", "Belo", "Takenos", "Santander", "Binance P2P"};

    static boolean isEnabled(Context c, String id) {
        return prefs(c).getBoolean("wallet_" + id, true);
    }

    static void setEnabled(Context c, String id, boolean on) {
        prefs(c).edit().putBoolean("wallet_" + id, on).apply();
    }

    /** Redibuja el widget con el último JSON guardado (sin red). Lo usa la app al cambiar la selección. */
    static void rerenderFromCache(Context c) {
        render(c, prefs(c).getString(KEY_JSON, null), false);
    }

    /** Descarga widget.json, lo valida y lo guarda. Llamar fuera del hilo principal. */
    static String fetchAndStore(Context c) throws Exception {
        String json = download(JSON_URL);
        new JSONObject(json); // valida antes de guardar
        prefs(c).edit().putString(KEY_JSON, json).apply();
        return json;
    }

    /** Hora de los datos guardados ("18:00") o null si no hay. Para la línea de estado de la app. */
    static String cachedUpdatedTime(Context c) {
        try {
            String json = prefs(c).getString(KEY_JSON, null);
            if (json == null) return null;
            return new JSONObject(json).getJSONObject("display").optString("updatedTime", null);
        } catch (Exception e) {
            return null;
        }
    }

    private static String download(String url) throws Exception {
        // Parámetro que cambia cada minuto para esquivar cachés intermedios.
        URL u = new URL(url + "?t=" + (System.currentTimeMillis() / 60000));
        HttpURLConnection c = (HttpURLConnection) u.openConnection();
        c.setConnectTimeout(8000);
        c.setReadTimeout(8000);
        c.setRequestProperty("Cache-Control", "no-cache");
        try (InputStream in = c.getInputStream()) {
            if (c.getResponseCode() != 200) throw new Exception("HTTP " + c.getResponseCode());
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[4096];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            return new String(out.toByteArray(), StandardCharsets.UTF_8);
        } finally {
            c.disconnect();
        }
    }

    static void render(Context context, String json, boolean offline) {
        RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.widget_rates);

        // Tocar el encabezado refresca; tocar el resto abre la web.
        Intent refresh = new Intent(context, RatesWidget.class).setAction(ACTION_REFRESH);
        v.setOnClickPendingIntent(R.id.header, PendingIntent.getBroadcast(
                context, 0, refresh, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        Intent web = new Intent(Intent.ACTION_VIEW, Uri.parse(WEB_URL));
        v.setOnClickPendingIntent(R.id.root, PendingIntent.getActivity(
                context, 1, web, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));

        try {
            if (json == null) throw new Exception("sin datos");
            JSONObject root = new JSONObject(json);
            JSONObject display = root.getJSONObject("display");
            String updatedTime = display.optString("updatedTime", "");

            // JSON nuevo (con `wallets` y `routes`): se filtra por la selección de la app.
            // JSON viejo: se dibuja `display` tal cual (todas las billeteras).
            JSONArray wallets = root.optJSONArray("wallets");
            JSONArray routes = root.optJSONArray("routes");
            boolean filter = wallets != null && routes != null;

            // Filas: las billeteras tildadas, en el orden del JSON (con tasa de mayor a menor,
            // después las caídas). Se normalizan al formato de display.rows.
            JSONArray rows;
            int failed = 0;
            int selected = 0;
            if (filter) {
                rows = new JSONArray();
                int rank = 0;
                for (int i = 0; i < wallets.length(); i++) {
                    JSONObject w = wallets.getJSONObject(i);
                    if (!isEnabled(context, w.optString("id"))) continue;
                    selected++;
                    boolean ok = w.optBoolean("ok", false);
                    if (!ok) failed++;
                    if (rows.length() >= 3) continue;
                    JSONObject r = new JSONObject();
                    r.put("rank", ok ? String.valueOf(++rank) : "–");
                    r.put("name", w.optString("name"));
                    r.put("value", w.optString("value"));
                    r.put("isError", ok ? 0 : 1);
                    r.put("isBest", ok && rank == 1 ? 1 : 0);
                    rows.put(r);
                }
            } else {
                rows = display.getJSONArray("rows");
            }

            String header;
            boolean hasError;
            if (filter) {
                hasError = failed > 0;
                header = failed > 0
                        ? "⚠ " + failed + (failed == 1 ? " fuente sin datos" : " fuentes sin datos") + " · " + updatedTime
                        : "Act. " + updatedTime;
            } else {
                header = display.optString("header", "");
                hasError = display.optInt("hasErrorNum", 0) == 1;
            }
            if (offline) {
                header = "⚠ Sin conexión · " + updatedTime;
                hasError = true;
            }
            v.setTextViewText(R.id.status, header);
            v.setTextColor(R.id.status, hasError ? RED : DIM);

            for (int i = 0; i < 3; i++) {
                if (i < rows.length()) {
                    JSONObject r = rows.getJSONObject(i);
                    boolean err = r.optInt("isError", 0) == 1;
                    boolean best = r.optInt("isBest", 0) == 1;
                    v.setTextViewText(RANK[i], r.optString("rank", ""));
                    v.setTextViewText(NAME[i], r.optString("name", ""));
                    v.setTextViewText(VALUE[i], r.optString("value", ""));
                    v.setTextColor(NAME[i], err ? DIM : WHITE);
                    v.setTextColor(VALUE[i], err ? RED : best ? GREEN : WHITE);
                } else {
                    v.setTextViewText(RANK[i], "");
                    v.setTextViewText(NAME[i], "");
                    v.setTextViewText(VALUE[i], "");
                }
            }

            String routeName;
            String routeTotal;
            if (filter) {
                // Mejor ruta = la primera (vienen de mejor a peor) cuyas billeteras están todas tildadas.
                JSONObject best = null;
                for (int i = 0; i < routes.length() && best == null; i++) {
                    JSONObject r = routes.getJSONObject(i);
                    JSONArray ws = r.optJSONArray("wallets");
                    boolean all = true;
                    for (int k = 0; ws != null && k < ws.length(); k++) {
                        if (!isEnabled(context, ws.getString(k))) { all = false; break; }
                    }
                    if (all) best = r;
                }
                if (best != null) {
                    routeName = best.optString("name");
                    routeTotal = best.optString("total");
                } else if (selected == 0) {
                    routeName = "Elegí billeteras en la app";
                    routeTotal = "—";
                } else if (failed > 0) {
                    routeName = "Error: sin rutas";
                    routeTotal = "Error";
                } else {
                    // p. ej. solo Santander: el optimizador no tiene ruta por Santander.
                    routeName = "Sin ruta para las billeteras elegidas";
                    routeTotal = "—";
                }
            } else {
                routeName = display.optString("routeName", "");
                routeTotal = display.optString("routeTotal", "");
            }
            v.setTextViewText(R.id.route, routeName);
            v.setTextViewText(R.id.total, routeTotal);
            v.setTextViewText(R.id.caption, display.optString("routeCaption", ""));
        } catch (Exception e) {
            v.setTextViewText(R.id.status, "⚠ Sin datos · tocá para reintentar");
            v.setTextColor(R.id.status, RED);
        }

        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        manager.updateAppWidget(new ComponentName(context, RatesWidget.class), v);
    }
}
