package tech.elysiaseraphis.naim;

import android.Manifest;
import android.app.Activity;
import android.app.DownloadManager;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.io.IOException;
import java.util.Base64;

public final class MainActivity extends Activity {
    private static final int FILE_CHOOSER_REQUEST = 41;
    private static final int NOTIFICATION_REQUEST = 42;
    private WebView webView;
    private ValueCallback<Uri[]> fileCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        settings.setMediaPlaybackRequiresUserGesture(false);

        webView.addJavascriptInterface(new AndroidBridge(), "AndroidNative");
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                             FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                try {
                    startActivityForResult(params.createIntent(), FILE_CHOOSER_REQUEST);
                } catch (Exception error) {
                    fileCallback = null;
                    Toast.makeText(MainActivity.this, R.string.file_picker_error, Toast.LENGTH_SHORT).show();
                }
                return true;
            }
        });
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("appassets.androidplatform.net".equals(uri.getHost())) return false;
                startActivity(new Intent(Intent.ACTION_VIEW, uri));
                return true;
            }

            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (!"appassets.androidplatform.net".equals(uri.getHost())) return null;
                String path = uri.getPath();
                if (path == null || path.contains("..")) return null;
                if (path.startsWith("/")) path = path.substring(1);
                if (path.isEmpty()) path = "index.html";
                String mime = path.endsWith(".js") ? "application/javascript"
                        : path.endsWith(".json") ? "application/json"
                        : path.endsWith(".png") ? "image/png" : "text/html";
                try {
                    return new WebResourceResponse(mime, "UTF-8", getAssets().open(path));
                } catch (IOException error) {
                    return null;
                }
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                injectNativeShare();
            }
        });
        webView.setDownloadListener((url, userAgent, disposition, mimeType, length) -> {
            String name = android.webkit.URLUtil.guessFileName(url, disposition, mimeType);
            if (url.startsWith("blob:") || url.startsWith("data:")) {
                String script = "(async function(){const r=await fetch(" + JSONObject.quote(url) +
                        ");const b=await r.blob();const fr=new FileReader();fr.onload=()=>AndroidNative.saveBase64(fr.result," +
                        JSONObject.quote(name) + ",b.type);fr.readAsDataURL(b);})().catch(e=>console.error(e));";
                webView.evaluateJavascript(script, null);
            } else {
                DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
                request.setMimeType(mimeType);
                request.addRequestHeader("User-Agent", userAgent);
                request.addRequestHeader("Cookie", CookieManager.getInstance().getCookie(url));
                request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                if (Build.VERSION.SDK_INT >= 29) {
                    request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name);
                } else {
                    request.setDestinationInExternalFilesDir(
                            MainActivity.this, Environment.DIRECTORY_DOWNLOADS, name);
                }
                ((DownloadManager) getSystemService(DOWNLOAD_SERVICE)).enqueue(request);
            }
        });

        if (savedInstanceState == null) {
            webView.loadUrl("https://appassets.androidplatform.net/index.html");
        } else {
            webView.restoreState(savedInstanceState);
        }
    }

    private void injectNativeShare() {
        String script = "if(!navigator.share&&window.AndroidNative)navigator.share=async function(o){" +
                "if(o.files&&o.files[0]){const f=o.files[0],r=new FileReader();" +
                "r.onload=()=>AndroidNative.shareBase64(r.result,f.name,f.type);r.readAsDataURL(f);" +
                "}else AndroidNative.shareText(o.title||'',o.text||'',o.url||'');};";
        webView.evaluateJavascript(script, null);
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_CHOOSER_REQUEST && fileCallback != null) {
            fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
            fileCallback = null;
        }
    }

    @Override
    public void onBackPressed() {
        String script = "(function(){const s=['#exifModal.open','#lightbox.open','#fileMgrModal.open'," +
                "'#dataManageModal.open','#cfg-panel[data-open=\"true\"]'];" +
                "const open=s.some(x=>document.querySelector(x));" +
                "if(open)document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));return open;})()";
        webView.evaluateJavascript(script, value -> {
            if ("true".equals(value)) return;
            if (webView.canGoBack()) webView.goBack(); else MainActivity.super.onBackPressed();
        });
    }

    private void startGenerationService() {
        if (Build.VERSION.SDK_INT >= 33 &&
                checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, NOTIFICATION_REQUEST);
        }
        Intent intent = new Intent(this, GenerationService.class).setAction(GenerationService.ACTION_START);
        try {
            startForegroundService(intent);
        } catch (RuntimeException error) {
            Toast.makeText(this, R.string.background_service_failed, Toast.LENGTH_SHORT).show();
        }
    }

    private void stopGenerationService() {
        stopService(new Intent(this, GenerationService.class).setAction(GenerationService.ACTION_STOP));
    }

    @Override
    protected void onDestroy() {
        if (isFinishing()) stopGenerationService();
        super.onDestroy();
    }

    private byte[] decodeDataUrl(String value) {
        int comma = value.indexOf(',');
        String encoded = comma >= 0 ? value.substring(comma + 1) : value;
        return Base64.getDecoder().decode(encoded);
    }

    private String safeName(String name) {
        String clean = name == null ? "" : name.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "_");
        return clean.isEmpty() ? "naim_" + System.currentTimeMillis() + ".png" : clean;
    }

    private Uri saveDownload(String dataUrl, String filename, String mime) throws Exception {
        byte[] bytes = decodeDataUrl(dataUrl);
        String name = safeName(filename);
        if (Build.VERSION.SDK_INT >= 29) {
            android.content.ContentValues values = new android.content.ContentValues();
            values.put(MediaStore.Downloads.DISPLAY_NAME, name);
            values.put(MediaStore.Downloads.MIME_TYPE, mime);
            values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/NAIM");
            Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            if (uri == null) throw new IllegalStateException("download URI unavailable");
            try (OutputStream output = getContentResolver().openOutputStream(uri)) {
                if (output == null) throw new IllegalStateException("download stream unavailable");
                output.write(bytes);
            }
            return uri;
        }
        File dir = new File(getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), "NAIM");
        if (!dir.exists() && !dir.mkdirs()) throw new IllegalStateException("download directory unavailable");
        File file = new File(dir, name);
        try (OutputStream output = new FileOutputStream(file)) { output.write(bytes); }
        return Uri.fromFile(file);
    }

    private final class AndroidBridge {
        @JavascriptInterface
        public void generationStarted() {
            runOnUiThread(MainActivity.this::startGenerationService);
        }

        @JavascriptInterface
        public void generationFinished() {
            runOnUiThread(MainActivity.this::stopGenerationService);
        }

        @JavascriptInterface
        public void setThemeColors(String status, String navigation) {
            runOnUiThread(() -> {
                try {
                    getWindow().setStatusBarColor(Color.parseColor(status));
                    getWindow().setNavigationBarColor(Color.parseColor(navigation));
                } catch (IllegalArgumentException ignored) {}
            });
        }

        @JavascriptInterface
        public void copyText(String text) {
            ClipboardManager manager = (ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
            manager.setPrimaryClip(ClipData.newPlainText("NAIM", text));
        }

        @JavascriptInterface
        public void saveBase64(String dataUrl, String filename, String mime) {
            new Thread(() -> {
                try {
                    saveDownload(dataUrl, filename, mime);
                    runOnUiThread(() -> Toast.makeText(MainActivity.this, R.string.download_saved, Toast.LENGTH_SHORT).show());
                } catch (Exception error) {
                    runOnUiThread(() -> Toast.makeText(MainActivity.this, R.string.download_failed, Toast.LENGTH_SHORT).show());
                }
            }).start();
        }

        @JavascriptInterface
        public void shareText(String title, String text, String url) {
            runOnUiThread(() -> {
                Intent intent = new Intent(Intent.ACTION_SEND);
                intent.setType("text/plain");
                intent.putExtra(Intent.EXTRA_SUBJECT, title);
                intent.putExtra(Intent.EXTRA_TEXT, (text + " " + url).trim());
                startActivity(Intent.createChooser(intent, getString(R.string.share)));
            });
        }

        @JavascriptInterface
        public void shareBase64(String dataUrl, String filename, String mime) {
            new Thread(() -> {
                try {
                    File file = new File(getCacheDir(), safeName(filename));
                    try (OutputStream output = new FileOutputStream(file)) { output.write(decodeDataUrl(dataUrl)); }
                    Uri uri = new Uri.Builder().scheme("content")
                            .authority(getPackageName() + ".files")
                            .appendPath(file.getName()).build();
                    runOnUiThread(() -> {
                        Intent intent = new Intent(Intent.ACTION_SEND);
                        intent.setType(mime == null || mime.isEmpty() ? "application/octet-stream" : mime);
                        intent.putExtra(Intent.EXTRA_STREAM, uri);
                        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        startActivity(Intent.createChooser(intent, getString(R.string.share)));
                    });
                } catch (Exception error) {
                    runOnUiThread(() -> Toast.makeText(MainActivity.this, R.string.share_failed, Toast.LENGTH_SHORT).show());
                }
            }).start();
        }
    }
}
