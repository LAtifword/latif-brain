package com.latif.brain;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Bundle;
import android.provider.OpenableColumns;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.view.Window;
import android.widget.Button;
import android.widget.EditText;
import android.widget.HorizontalScrollView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.SeekBar;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends Activity {
    private static final int IMPORT_TEXT = 2001;
    private static final int PICK_MUSIC = 2002;
    private static final int BG = Color.rgb(7, 11, 20);
    private static final int PANEL = Color.rgb(16, 23, 42);
    private static final int PANEL_2 = Color.rgb(24, 33, 56);
    private static final int TEXT = Color.rgb(244, 247, 255);
    private static final int MUTED = Color.rgb(150, 163, 186);
    private static final int PURPLE = Color.rgb(139, 92, 246);
    private static final int CYAN = Color.rgb(56, 189, 248);
    private static final String[] OPENAI_VOICES = {
            "marin", "cedar", "coral", "alloy", "ash", "ballad", "echo", "fable", "nova", "onyx"
    };
    private static final String[] STYLES = {"Natural", "Warm", "Cinematic", "Calm"};

    private final List<Book> books = new ArrayList<>();
    private final List<String> chunks = new ArrayList<>();
    private final ExecutorService networkExecutor = Executors.newSingleThreadExecutor();

    private SharedPreferences prefs;
    private LinearLayout listBox;
    private EditText search;
    private TextView playerTitle, playerState, libraryCount, musicStatus, engineStatus;
    private Button playPause, favoriteButton, rateButton, voiceButton, engineButton, styleButton, musicButton;
    private SeekBar musicVolume;
    private TextToSpeech tts;
    private MediaPlayer narrationPlayer;
    private MediaPlayer musicPlayer;
    private Book currentBook;
    private int currentChunk = 0;
    private boolean playing = false;
    private boolean generating = false;
    private boolean openAiPaused = false;
    private float speechRate = 1.0f;
    private String filterMode = "all";
    private String engine = "device";
    private String selectedVoice = "marin";
    private String narrationStyle = "Natural";
    private float bgVolume = 0.18f;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        Window w = getWindow();
        w.setStatusBarColor(BG);
        w.setNavigationBarColor(BG);
        prefs = getSharedPreferences("latif_brain", MODE_PRIVATE);
        speechRate = prefs.getFloat("speech_rate", 1.0f);
        engine = prefs.getString("voice_engine", "device");
        selectedVoice = prefs.getString("openai_voice", "marin");
        narrationStyle = prefs.getString("narration_style", "Natural");
        bgVolume = prefs.getFloat("music_volume", 0.18f);
        loadBooks();
        buildUi();
        initTts();
        restoreMusic();
    }

    private void buildUi() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(18), dp(14), dp(18), dp(12));
        root.setBackgroundColor(BG);

        LinearLayout brandRow = new LinearLayout(this);
        brandRow.setGravity(Gravity.CENTER_VERTICAL);
        TextView mark = label("◉", 32, PURPLE, true);
        brandRow.addView(mark, lp(dp(48), dp(48)));
        LinearLayout brandText = new LinearLayout(this);
        brandText.setOrientation(LinearLayout.VERTICAL);
        brandText.addView(label("LATIF BRAIN", 25, TEXT, true));
        brandText.addView(label("Natural narration studio • local library", 12, MUTED, false));
        brandRow.addView(brandText, new LinearLayout.LayoutParams(0, -2, 1));
        TextView badge = label("V1.1", 11, Color.rgb(196,181,253), true);
        badge.setGravity(Gravity.CENTER);
        badge.setPadding(dp(10), dp(7), dp(10), dp(7));
        badge.setBackground(round(Color.rgb(35,24,70), dp(18), Color.rgb(80,62,130)));
        brandRow.addView(badge);
        root.addView(brandRow);

        TextView hero = label("Books that sound alive.", 28, TEXT, true);
        hero.setPadding(0, dp(18), 0, dp(4));
        root.addView(hero);
        TextView sub = label("Choose a natural voice, mix background music, and keep device speech as an offline fallback.", 13, MUTED, false);
        sub.setPadding(0, 0, 0, dp(12));
        root.addView(sub);

        search = new EditText(this);
        search.setHint("Search titles or book text…");
        search.setHintTextColor(MUTED);
        search.setTextColor(TEXT);
        search.setSingleLine(true);
        search.setPadding(dp(16), 0, dp(16), 0);
        search.setBackground(round(PANEL, dp(16), Color.rgb(49,62,89)));
        root.addView(search, lp(-1, dp(50)));
        search.addTextChangedListener(new SimpleTextWatcher(this::renderBooks));

        LinearLayout actions = new LinearLayout(this);
        actions.setPadding(0, dp(10), 0, dp(8));
        Button importBtn = action("＋ IMPORT TXT", PURPLE);
        importBtn.setOnClickListener(v -> chooseText());
        actions.addView(importBtn, new LinearLayout.LayoutParams(0, dp(44), 1));
        Button continueBtn = action("▶ CONTINUE", Color.rgb(30,80,110));
        LinearLayout.LayoutParams cLp = new LinearLayout.LayoutParams(0, dp(44), 1); cLp.setMarginStart(dp(8));
        actions.addView(continueBtn, cLp);
        continueBtn.setOnClickListener(v -> continueListening());
        root.addView(actions);

        LinearLayout studio = new LinearLayout(this);
        studio.setOrientation(LinearLayout.VERTICAL);
        studio.setPadding(dp(13), dp(12), dp(13), dp(12));
        studio.setBackground(round(PANEL, dp(18), Color.rgb(53,49,86)));
        TextView studioTitle = label("NARRATION STUDIO", 12, CYAN, true);
        studio.addView(studioTitle);
        engineStatus = label("", 11, MUTED, false);
        engineStatus.setPadding(0, dp(3), 0, dp(8));
        studio.addView(engineStatus);

        LinearLayout voiceRow = new LinearLayout(this);
        engineButton = action("", Color.rgb(45,72,96));
        engineButton.setOnClickListener(v -> toggleEngine());
        voiceRow.addView(engineButton, new LinearLayout.LayoutParams(0, dp(42), 1));
        voiceButton = action("", PANEL_2);
        LinearLayout.LayoutParams vLp = new LinearLayout.LayoutParams(0, dp(42), 1); vLp.setMarginStart(dp(7));
        voiceRow.addView(voiceButton, vLp);
        voiceButton.setOnClickListener(v -> cycleVoice());
        styleButton = action("", PANEL_2);
        LinearLayout.LayoutParams sLp = new LinearLayout.LayoutParams(0, dp(42), 1); sLp.setMarginStart(dp(7));
        voiceRow.addView(styleButton, sLp);
        styleButton.setOnClickListener(v -> cycleStyle());
        studio.addView(voiceRow);

        LinearLayout keyRow = new LinearLayout(this);
        keyRow.setPadding(0, dp(8), 0, 0);
        Button keyButton = action("OPENAI API KEY", Color.rgb(58,43,91));
        keyButton.setOnClickListener(v -> showApiKeyDialog());
        keyRow.addView(keyButton, new LinearLayout.LayoutParams(0, dp(40), 1));
        rateButton = action(String.format(Locale.US, "%.1fx", speechRate), PANEL_2);
        LinearLayout.LayoutParams rLp = new LinearLayout.LayoutParams(dp(76), dp(40)); rLp.setMarginStart(dp(7));
        keyRow.addView(rateButton, rLp);
        rateButton.setOnClickListener(v -> cycleRate());
        studio.addView(keyRow);
        root.addView(studio);

        LinearLayout musicBox = new LinearLayout(this);
        musicBox.setOrientation(LinearLayout.VERTICAL);
        musicBox.setPadding(dp(13), dp(10), dp(13), dp(10));
        LinearLayout.LayoutParams mbLp = new LinearLayout.LayoutParams(-1, -2); mbLp.setMargins(0, dp(8), 0, dp(8));
        musicBox.setLayoutParams(mbLp);
        musicBox.setBackground(round(Color.rgb(12,29,44), dp(18), Color.rgb(36,75,97)));
        LinearLayout musicTop = new LinearLayout(this);
        musicTop.setGravity(Gravity.CENTER_VERTICAL);
        LinearLayout musicTexts = new LinearLayout(this);
        musicTexts.setOrientation(LinearLayout.VERTICAL);
        musicTexts.addView(label("BACKGROUND MUSIC", 12, CYAN, true));
        musicStatus = label("No track selected", 11, MUTED, false);
        musicTexts.addView(musicStatus);
        musicTop.addView(musicTexts, new LinearLayout.LayoutParams(0, -2, 1));
        musicButton = action("CHOOSE", Color.rgb(24,78,104));
        musicButton.setOnClickListener(v -> chooseMusic());
        musicTop.addView(musicButton, lp(dp(92), dp(40)));
        musicBox.addView(musicTop);
        TextView volumeLabel = label("Music volume", 11, MUTED, false);
        volumeLabel.setPadding(0, dp(7), 0, 0);
        musicBox.addView(volumeLabel);
        musicVolume = new SeekBar(this);
        musicVolume.setMax(100);
        musicVolume.setProgress(Math.round(bgVolume * 100f));
        musicVolume.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            @Override public void onProgressChanged(SeekBar seekBar, int progress, boolean fromUser) {
                bgVolume = progress / 100f;
                prefs.edit().putFloat("music_volume", bgVolume).apply();
                applyMusicVolume();
            }
            @Override public void onStartTrackingTouch(SeekBar seekBar) {}
            @Override public void onStopTrackingTouch(SeekBar seekBar) {}
        });
        musicBox.addView(musicVolume);
        root.addView(musicBox);

        HorizontalScrollView chipsScroll = new HorizontalScrollView(this);
        chipsScroll.setHorizontalScrollBarEnabled(false);
        LinearLayout chips = new LinearLayout(this);
        chips.addView(chip("All", "all"));
        chips.addView(chip("Favorites", "favorites"));
        chips.addView(chip("Recent", "recent"));
        libraryCount = label("", 12, MUTED, false);
        libraryCount.setGravity(Gravity.CENTER_VERTICAL);
        libraryCount.setPadding(dp(12), 0, 0, 0);
        chips.addView(libraryCount);
        chipsScroll.addView(chips);
        root.addView(chipsScroll, lp(-1, dp(45)));

        ScrollView scroll = new ScrollView(this);
        listBox = new LinearLayout(this);
        listBox.setOrientation(LinearLayout.VERTICAL);
        listBox.setPadding(0, 0, 0, dp(8));
        scroll.addView(listBox);
        root.addView(scroll, new LinearLayout.LayoutParams(-1, 0, 1));

        LinearLayout player = new LinearLayout(this);
        player.setOrientation(LinearLayout.VERTICAL);
        player.setPadding(dp(14), dp(10), dp(14), dp(10));
        player.setBackground(round(PANEL, dp(20), Color.rgb(64,52,105)));
        playerTitle = label("Nothing playing", 15, TEXT, true);
        playerTitle.setMaxLines(1);
        playerState = label("Choose a book to start listening", 11, MUTED, false);
        player.addView(playerTitle);
        player.addView(playerState);
        LinearLayout controls = new LinearLayout(this);
        controls.setGravity(Gravity.CENTER_VERTICAL);
        playPause = action("▶ PLAY", PURPLE);
        playPause.setOnClickListener(v -> togglePlayback());
        controls.addView(playPause, new LinearLayout.LayoutParams(0, dp(43), 1));
        favoriteButton = action("☆", PANEL_2);
        LinearLayout.LayoutParams fLp = new LinearLayout.LayoutParams(dp(56), dp(43)); fLp.setMarginStart(dp(8));
        controls.addView(favoriteButton, fLp);
        favoriteButton.setOnClickListener(v -> toggleCurrentFavorite());
        player.addView(controls);
        root.addView(player);

        setContentView(root);
        refreshStudioButtons();
        renderBooks();
    }

    private void initTts() {
        tts = new TextToSpeech(this, status -> {
            if (status != TextToSpeech.SUCCESS) return;
            int lang = tts.setLanguage(Locale.getDefault());
            tts.setSpeechRate(speechRate);
            if (lang == TextToSpeech.LANG_MISSING_DATA || lang == TextToSpeech.LANG_NOT_SUPPORTED) tts.setLanguage(Locale.US);
            tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                @Override public void onStart(String id) { runOnUiThread(MainActivity.this::updatePlayer); }
                @Override public void onError(String id) { runOnUiThread(() -> finishChunk(false, "Device speech failed.")); }
                @Override public void onDone(String id) {
                    if (!playing || currentBook == null) return;
                    advanceChunk();
                }
            });
        });
    }

    private void toggleEngine() {
        engine = "openai".equals(engine) ? "device" : "openai";
        prefs.edit().putString("voice_engine", engine).apply();
        stopNarrationOnly();
        refreshStudioButtons();
        updatePlayer();
    }

    private void cycleVoice() {
        int index = 0;
        for (int i = 0; i < OPENAI_VOICES.length; i++) if (OPENAI_VOICES[i].equals(selectedVoice)) index = i;
        selectedVoice = OPENAI_VOICES[(index + 1) % OPENAI_VOICES.length];
        prefs.edit().putString("openai_voice", selectedVoice).apply();
        refreshStudioButtons();
    }

    private void cycleStyle() {
        int index = 0;
        for (int i = 0; i < STYLES.length; i++) if (STYLES[i].equals(narrationStyle)) index = i;
        narrationStyle = STYLES[(index + 1) % STYLES.length];
        prefs.edit().putString("narration_style", narrationStyle).apply();
        refreshStudioButtons();
    }

    private void refreshStudioButtons() {
        if (engineButton == null) return;
        engineButton.setText("openai".equals(engine) ? "AI NATURAL" : "DEVICE TTS");
        voiceButton.setText(selectedVoice.toUpperCase(Locale.ROOT));
        styleButton.setText(narrationStyle.toUpperCase(Locale.ROOT));
        boolean hasKey = !prefs.getString("openai_api_key", "").trim().isEmpty();
        engineStatus.setText("openai".equals(engine)
                ? (hasKey ? "OpenAI natural narration ready • internet required" : "Add an API key to enable natural narration")
                : "Offline device speech • no API usage");
    }

    private void showApiKeyDialog() {
        EditText input = new EditText(this);
        input.setTextColor(TEXT);
        input.setHintTextColor(MUTED);
        input.setHint("sk-…");
        input.setSingleLine(true);
        input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        input.setText(prefs.getString("openai_api_key", ""));
        int pad = dp(18);
        input.setPadding(pad, pad, pad, pad);
        AlertDialog d = new AlertDialog.Builder(this)
                .setTitle("OpenAI API key")
                .setMessage("Stored only in this app's private preferences. It is never embedded in the APK.")
                .setView(input)
                .setPositiveButton("SAVE", (dialog, which) -> {
                    prefs.edit().putString("openai_api_key", input.getText().toString().trim()).apply();
                    refreshStudioButtons();
                    toast("API key saved locally");
                })
                .setNeutralButton("CLEAR", (dialog, which) -> {
                    prefs.edit().remove("openai_api_key").apply();
                    refreshStudioButtons();
                })
                .setNegativeButton("CANCEL", null)
                .create();
        d.show();
    }

    private void chooseMusic() {
        Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        i.addCategory(Intent.CATEGORY_OPENABLE);
        i.setType("audio/*");
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        startActivityForResult(i, PICK_MUSIC);
    }

    private void restoreMusic() {
        String raw = prefs.getString("background_music_uri", "");
        if (raw.isEmpty()) return;
        prepareMusic(Uri.parse(raw), false);
    }

    private void prepareMusic(Uri uri, boolean remember) {
        releaseMusic();
        try {
            MediaPlayer p = new MediaPlayer();
            p.setDataSource(this, uri);
            p.setLooping(true);
            p.setVolume(bgVolume, bgVolume);
            p.setOnPreparedListener(mp -> {
                musicPlayer = mp;
                applyMusicVolume();
                if (playing) mp.start();
                if (musicStatus != null) musicStatus.setText("Track ready • loops under narration");
                if (musicButton != null) musicButton.setText("CHANGE");
            });
            p.setOnErrorListener((mp, what, extra) -> {
                if (musicStatus != null) musicStatus.setText("Track unavailable");
                releaseMusic();
                return true;
            });
            p.prepareAsync();
            if (remember) prefs.edit().putString("background_music_uri", uri.toString()).apply();
        } catch (Exception e) {
            if (musicStatus != null) musicStatus.setText("Could not load track");
        }
    }

    private void applyMusicVolume() {
        try { if (musicPlayer != null) musicPlayer.setVolume(bgVolume, bgVolume); } catch (Exception ignored) {}
    }

    private void startMusic() {
        try { if (musicPlayer != null && !musicPlayer.isPlaying()) musicPlayer.start(); } catch (Exception ignored) {}
    }

    private void pauseMusic() {
        try { if (musicPlayer != null && musicPlayer.isPlaying()) musicPlayer.pause(); } catch (Exception ignored) {}
    }

    private void releaseMusic() {
        try { if (musicPlayer != null) { musicPlayer.stop(); musicPlayer.release(); } } catch (Exception ignored) {}
        musicPlayer = null;
    }

    private void chooseText() {
        Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        i.addCategory(Intent.CATEGORY_OPENABLE);
        i.setType("text/*");
        startActivityForResult(i, IMPORT_TEXT);
    }

    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (result != RESULT_OK || data == null || data.getData() == null) return;
        Uri uri = data.getData();
        if (request == PICK_MUSIC) {
            try {
                getContentResolver().takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
            } catch (Exception ignored) {}
            prepareMusic(uri, true);
            return;
        }
        if (request != IMPORT_TEXT) return;
        try {
            String name = displayName(uri);
            byte[] bytes = readLimited(getContentResolver().openInputStream(uri), 5 * 1024 * 1024);
            String text = new String(bytes, StandardCharsets.UTF_8).trim();
            if (text.isEmpty()) { toast("That text file is empty."); return; }
            String title = name == null ? "Imported book" : name.replaceFirst("(?i)\\.txt$", "");
            addBook(title, text);
            toast("Added to your local library");
        } catch (Exception e) { toast("Could not import this text file."); }
    }

    private String displayName(Uri uri) {
        try (Cursor c = getContentResolver().query(uri, new String[]{OpenableColumns.DISPLAY_NAME}, null, null, null)) {
            if (c != null && c.moveToFirst()) return c.getString(0);
        } catch (Exception ignored) {}
        return "Imported book";
    }

    private byte[] readLimited(InputStream in, int limit) throws Exception {
        if (in == null) throw new Exception("No stream");
        try (InputStream src = in; ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] b = new byte[8192]; int n, total = 0;
            while ((n = src.read(b)) > 0) {
                total += n;
                if (total > limit) throw new Exception("Too large");
                out.write(b, 0, n);
            }
            return out.toByteArray();
        }
    }

    private void addBook(String title, String text) throws Exception {
        String id = "book_" + System.currentTimeMillis();
        File f = new File(getFilesDir(), id + ".txt");
        try (FileOutputStream out = new FileOutputStream(f)) { out.write(text.getBytes(StandardCharsets.UTF_8)); }
        Book b = new Book(id, title, f.getName(), false, System.currentTimeMillis());
        books.add(0, b);
        saveBooks();
        renderBooks();
        selectBook(b, false);
    }

    private void loadBooks() {
        books.clear();
        try {
            File meta = new File(getFilesDir(), "books.json");
            if (meta.exists()) {
                JSONArray a = new JSONArray(readFile(meta));
                for (int i = 0; i < a.length(); i++) {
                    JSONObject o = a.getJSONObject(i);
                    File f = new File(getFilesDir(), o.getString("file"));
                    if (f.exists()) books.add(new Book(o.getString("id"), o.getString("title"), o.getString("file"), o.optBoolean("favorite"), o.optLong("added", 0)));
                }
            }
        } catch (Exception ignored) {}
        if (books.isEmpty()) seedWelcome();
    }

    private void seedWelcome() {
        String intro = "Welcome to LATIF BRAIN.\n\nVersion 1.1 adds Narration Studio. You can listen offline with your phone's speech engine, or add your own OpenAI API key and choose a natural narration voice.\n\nYou can also choose background music and control its volume so it stays underneath the narration. The music file remains on your device.\n\nImport a plain text book, select it, choose your narration engine and voice, then press Play.";
        try { addBook("Welcome to LATIF BRAIN", intro); } catch (Exception ignored) {}
    }

    private void saveBooks() {
        try {
            JSONArray a = new JSONArray();
            for (Book b : books) {
                JSONObject o = new JSONObject();
                o.put("id", b.id); o.put("title", b.title); o.put("file", b.file); o.put("favorite", b.favorite); o.put("added", b.added);
                a.put(o);
            }
            try (FileOutputStream out = new FileOutputStream(new File(getFilesDir(), "books.json"))) {
                out.write(a.toString().getBytes(StandardCharsets.UTF_8));
            }
        } catch (Exception ignored) {}
    }

    private void renderBooks() {
        if (listBox == null) return;
        listBox.removeAllViews();
        String q = search == null ? "" : search.getText().toString().trim().toLowerCase(Locale.ROOT);
        int shown = 0;
        List<Book> source = new ArrayList<>(books);
        if ("recent".equals(filterMode)) source.sort((a, b) -> Long.compare(b.added, a.added));
        for (Book b : source) {
            if ("favorites".equals(filterMode) && !b.favorite) continue;
            if (!q.isEmpty() && !matches(b, q)) continue;
            shown++;
            listBox.addView(bookCard(b));
        }
        if (libraryCount != null) libraryCount.setText(shown + (shown == 1 ? " book" : " books"));
        if (shown == 0) {
            TextView empty = label("No books match this view.\nImport a TXT file to add one.", 14, MUTED, false);
            empty.setGravity(Gravity.CENTER);
            empty.setPadding(0, dp(38), 0, dp(38));
            listBox.addView(empty);
        }
    }

    private boolean matches(Book b, String q) {
        if (b.title.toLowerCase(Locale.ROOT).contains(q)) return true;
        try {
            String t = readFile(new File(getFilesDir(), b.file));
            if (t.length() > 180000) t = t.substring(0, 180000);
            return t.toLowerCase(Locale.ROOT).contains(q);
        } catch (Exception e) { return false; }
    }

    private View bookCard(Book b) {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(15), dp(12), dp(15), dp(12));
        card.setBackground(round(PANEL, dp(17), Color.rgb(42,52,77)));
        LinearLayout.LayoutParams box = new LinearLayout.LayoutParams(-1, -2); box.setMargins(0, 0, 0, dp(9)); card.setLayoutParams(box);
        card.addView(label((b.favorite ? "★  " : "") + b.title, 16, TEXT, true));
        int p = prefs.getInt("progress_" + b.id, 0);
        TextView meta = label(p > 0 ? "Saved listening position" : "Ready to narrate", 11, MUTED, false);
        meta.setPadding(0, dp(4), 0, dp(9));
        card.addView(meta);
        LinearLayout row = new LinearLayout(this);
        Button listen = action(currentBook == b ? "SELECTED" : "▶ LISTEN", currentBook == b ? Color.rgb(35,102,115) : PURPLE);
        listen.setOnClickListener(v -> selectBook(b, true));
        row.addView(listen, new LinearLayout.LayoutParams(0, dp(40), 1));
        Button fav = action(b.favorite ? "★" : "☆", PANEL_2);
        LinearLayout.LayoutParams fp = new LinearLayout.LayoutParams(dp(52), dp(40)); fp.setMarginStart(dp(8)); row.addView(fav, fp);
        fav.setOnClickListener(v -> { b.favorite = !b.favorite; saveBooks(); renderBooks(); if (currentBook == b) updatePlayer(); });
        Button del = action("×", PANEL_2);
        LinearLayout.LayoutParams dlp = new LinearLayout.LayoutParams(dp(52), dp(40)); dlp.setMarginStart(dp(8)); row.addView(del, dlp);
        del.setOnClickListener(v -> deleteBook(b));
        card.addView(row);
        return card;
    }

    private void deleteBook(Book b) {
        if (currentBook == b) {
            stopAllPlayback();
            currentBook = null;
            chunks.clear();
        }
        new File(getFilesDir(), b.file).delete();
        books.remove(b);
        prefs.edit().remove("progress_" + b.id).apply();
        saveBooks();
        renderBooks();
        updatePlayer();
    }

    private void selectBook(Book b, boolean autoPlay) {
        stopNarrationOnly();
        currentBook = b;
        chunks.clear();
        try {
            String text = readFile(new File(getFilesDir(), b.file));
            makeChunks(text);
            currentChunk = Math.max(0, Math.min(prefs.getInt("progress_" + b.id, 0), Math.max(0, chunks.size() - 1)));
        } catch (Exception e) {
            toast("Could not open this book.");
            return;
        }
        renderBooks();
        updatePlayer();
        if (autoPlay) { playing = true; startMusic(); speakCurrent(); updatePlayer(); }
    }

    private void makeChunks(String text) {
        chunks.clear();
        String clean = text.replace("\r", "").trim();
        int max = "openai".equals(engine) ? 1700 : 2800;
        int start = 0;
        while (start < clean.length()) {
            int end = Math.min(clean.length(), start + max);
            if (end < clean.length()) {
                int breakAt = Math.max(clean.lastIndexOf(". ", end), Math.max(clean.lastIndexOf("\n", end), clean.lastIndexOf(" ", end)));
                if (breakAt > start + 500) end = breakAt + 1;
            }
            chunks.add(clean.substring(start, end).trim());
            start = end;
        }
    }

    private void togglePlayback() {
        if (currentBook == null) {
            if (!books.isEmpty()) selectBook(books.get(0), false);
            else { toast("Import a book first."); return; }
        }
        if (playing) {
            playing = false;
            generating = false;
            if (narrationPlayer != null) {
                try {
                    if (narrationPlayer.isPlaying()) {
                        narrationPlayer.pause();
                        openAiPaused = true;
                    }
                } catch (Exception ignored) {}
            } else if (tts != null) tts.stop();
            pauseMusic();
        } else {
            playing = true;
            startMusic();
            if (openAiPaused && narrationPlayer != null) {
                try { narrationPlayer.start(); openAiPaused = false; } catch (Exception e) { speakCurrent(); }
            } else speakCurrent();
        }
        updatePlayer();
    }

    private void continueListening() {
        Book best = null;
        int bestProgress = -1;
        for (Book b : books) {
            int p = prefs.getInt("progress_" + b.id, 0);
            if (p > bestProgress) { bestProgress = p; best = b; }
        }
        if (best == null && !books.isEmpty()) best = books.get(0);
        if (best != null) selectBook(best, true); else toast("Import a book first.");
    }

    private void speakCurrent() {
        if (!playing || currentBook == null || chunks.isEmpty()) return;
        if (currentChunk >= chunks.size()) currentChunk = 0;
        if ("openai".equals(engine)) {
            String key = prefs.getString("openai_api_key", "").trim();
            if (key.isEmpty()) {
                toast("Add your OpenAI API key or switch to Device TTS.");
                playing = false;
                pauseMusic();
                updatePlayer();
                return;
            }
            requestOpenAiSpeech(chunks.get(currentChunk), key);
        } else {
            if (tts == null) { toast("Device speech is not ready."); return; }
            tts.setSpeechRate(speechRate);
            tts.speak(chunks.get(currentChunk), TextToSpeech.QUEUE_FLUSH, null, "latif_" + currentChunk);
        }
    }

    private void requestOpenAiSpeech(String text, String key) {
        if (generating) return;
        generating = true;
        updatePlayer();
        String voiceAtRequest = selectedVoice;
        String styleAtRequest = narrationStyle;
        float rateAtRequest = speechRate;
        networkExecutor.execute(() -> {
            HttpURLConnection conn = null;
            try {
                URL url = new URL("https://api.openai.com/v1/audio/speech");
                conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setConnectTimeout(15000);
                conn.setReadTimeout(60000);
                conn.setDoOutput(true);
                conn.setRequestProperty("Authorization", "Bearer " + key);
                conn.setRequestProperty("Content-Type", "application/json");
                JSONObject body = new JSONObject();
                body.put("model", "gpt-4o-mini-tts");
                body.put("voice", voiceAtRequest);
                body.put("input", text);
                body.put("response_format", "mp3");
                body.put("speed", Math.max(0.5, Math.min(2.0, rateAtRequest)));
                body.put("instructions", narrationInstructions(styleAtRequest));
                byte[] json = body.toString().getBytes(StandardCharsets.UTF_8);
                conn.setFixedLengthStreamingMode(json.length);
                conn.getOutputStream().write(json);
                int code = conn.getResponseCode();
                if (code < 200 || code >= 300) {
                    InputStream err = conn.getErrorStream();
                    String detail = err == null ? ("HTTP " + code) : new String(readLimited(err, 8192), StandardCharsets.UTF_8);
                    throw new Exception(detail);
                }
                byte[] audio = readLimited(conn.getInputStream(), 12 * 1024 * 1024);
                File out = new File(getCacheDir(), "latif_voice_" + System.nanoTime() + ".mp3");
                try (FileOutputStream fos = new FileOutputStream(out)) { fos.write(audio); }
                runOnUiThread(() -> playGeneratedSpeech(out));
            } catch (Exception e) {
                String msg = e.getMessage() == null ? "OpenAI narration failed" : e.getMessage();
                if (msg.length() > 180) msg = msg.substring(0, 180);
                String finalMsg = msg;
                runOnUiThread(() -> {
                    generating = false;
                    playing = false;
                    pauseMusic();
                    updatePlayer();
                    toast("Natural voice error: " + finalMsg);
                });
            } finally {
                if (conn != null) conn.disconnect();
            }
        });
    }

    private String narrationInstructions(String style) {
        String base = "Narrate this as a polished human audiobook performer. Use natural breath, phrasing, varied intonation, clear diction, and emotionally appropriate pauses. Avoid robotic cadence and exaggerated acting. Preserve the author's meaning and punctuation.";
        if ("Warm".equals(style)) return base + " Use a warm, intimate, reassuring tone with gentle energy.";
        if ("Cinematic".equals(style)) return base + " Use controlled cinematic presence, richer dynamics, and subtle dramatic emphasis.";
        if ("Calm".equals(style)) return base + " Use a calm, grounded, low-pressure delivery with smooth pacing.";
        return base + " Sound conversational, intelligent, balanced, and natural.";
    }

    private void playGeneratedSpeech(File file) {
        generating = false;
        if (!playing || currentBook == null) { file.delete(); return; }
        releaseNarrationPlayer();
        try {
            narrationPlayer = new MediaPlayer();
            narrationPlayer.setDataSource(file.getAbsolutePath());
            narrationPlayer.setOnPreparedListener(mp -> {
                if (playing) { mp.start(); startMusic(); }
                updatePlayer();
            });
            narrationPlayer.setOnCompletionListener(mp -> {
                file.delete();
                releaseNarrationPlayer();
                if (playing && currentBook != null) advanceChunk();
            });
            narrationPlayer.setOnErrorListener((mp, what, extra) -> {
                file.delete();
                finishChunk(false, "Generated audio could not play.");
                return true;
            });
            narrationPlayer.prepareAsync();
        } catch (Exception e) {
            file.delete();
            finishChunk(false, "Generated audio could not play.");
        }
    }

    private void advanceChunk() {
        currentChunk++;
        saveProgress();
        if (currentChunk < chunks.size()) speakCurrent();
        else runOnUiThread(() -> {
            playing = false;
            currentChunk = 0;
            saveProgress();
            pauseMusic();
            updatePlayer();
            toast("Book finished");
        });
    }

    private void finishChunk(boolean advance, String message) {
        playing = false;
        generating = false;
        pauseMusic();
        if (advance) advanceChunk();
        updatePlayer();
        if (message != null) toast(message);
    }

    private void saveProgress() {
        if (currentBook != null) prefs.edit().putInt("progress_" + currentBook.id, currentChunk).apply();
    }

    private void updatePlayer() {
        if (playerTitle == null) return;
        if (currentBook == null) {
            playerTitle.setText("Nothing playing");
            playerState.setText("Choose a book to start listening");
            playPause.setText("▶ PLAY");
            favoriteButton.setText("☆");
            return;
        }
        playerTitle.setText(currentBook.title);
        String mode = "openai".equals(engine) ? ("AI • " + selectedVoice + " • " + narrationStyle) : "Device TTS • offline";
        String state = generating ? "Generating natural narration…" : (playing ? "Playing" : "Paused");
        playerState.setText(state + " • " + mode + " • section " + (currentChunk + 1) + "/" + Math.max(1, chunks.size()));
        playPause.setText(playing ? "Ⅱ PAUSE" : "▶ PLAY");
        favoriteButton.setText(currentBook.favorite ? "★" : "☆");
    }

    private void toggleCurrentFavorite() {
        if (currentBook == null) return;
        currentBook.favorite = !currentBook.favorite;
        saveBooks();
        renderBooks();
        updatePlayer();
    }

    private void cycleRate() {
        if (speechRate < 1.0f) speechRate = 1.0f;
        else if (speechRate < 1.15f) speechRate = 1.15f;
        else if (speechRate < 1.3f) speechRate = 1.3f;
        else if (speechRate < 1.5f) speechRate = 1.5f;
        else speechRate = 0.9f;
        prefs.edit().putFloat("speech_rate", speechRate).apply();
        if (tts != null) tts.setSpeechRate(speechRate);
        if (rateButton != null) rateButton.setText(String.format(Locale.US, "%.2gx", speechRate));
    }

    private void stopNarrationOnly() {
        generating = false;
        openAiPaused = false;
        try { if (tts != null) tts.stop(); } catch (Exception ignored) {}
        releaseNarrationPlayer();
        playing = false;
        pauseMusic();
    }

    private void stopAllPlayback() {
        stopNarrationOnly();
        pauseMusic();
    }

    private void releaseNarrationPlayer() {
        try { if (narrationPlayer != null) { narrationPlayer.stop(); narrationPlayer.release(); } } catch (Exception ignored) {}
        narrationPlayer = null;
    }

    private String readFile(File f) throws Exception {
        try (FileInputStream in = new FileInputStream(f); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] b = new byte[8192]; int n;
            while ((n = in.read(b)) > 0) out.write(b, 0, n);
            return out.toString(StandardCharsets.UTF_8.name());
        }
    }

    private Button chip(String text, String mode) {
        Button b = action(text, PANEL_2);
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(-2, dp(38)); p.setMarginEnd(dp(7)); b.setLayoutParams(p);
        b.setOnClickListener(v -> { filterMode = mode; renderBooks(); });
        return b;
    }

    private Button action(String text, int color) {
        Button b = new Button(this);
        b.setText(text);
        b.setTextColor(TEXT);
        b.setTextSize(11);
        b.setAllCaps(false);
        b.setGravity(Gravity.CENTER);
        b.setPadding(dp(8), 0, dp(8), 0);
        b.setBackground(round(color, dp(13), Color.TRANSPARENT));
        return b;
    }

    private TextView label(String text, int size, int color, boolean bold) {
        TextView t = new TextView(this);
        t.setText(text);
        t.setTextColor(color);
        t.setTextSize(size);
        if (bold) t.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        return t;
    }

    private GradientDrawable round(int fill, int radius, int stroke) {
        GradientDrawable d = new GradientDrawable();
        d.setColor(fill);
        d.setCornerRadius(radius);
        if (stroke != Color.TRANSPARENT) d.setStroke(dp(1), stroke);
        return d;
    }

    private LinearLayout.LayoutParams lp(int w, int h) { return new LinearLayout.LayoutParams(w, h); }
    private int dp(int v) { return Math.round(v * getResources().getDisplayMetrics().density); }
    private void toast(String s) { Toast.makeText(this, s, Toast.LENGTH_LONG).show(); }

    @Override protected void onDestroy() {
        super.onDestroy();
        stopAllPlayback();
        releaseMusic();
        if (tts != null) { tts.shutdown(); tts = null; }
        networkExecutor.shutdownNow();
    }

    private static class Book {
        final String id, title, file;
        boolean favorite;
        final long added;
        Book(String id, String title, String file, boolean favorite, long added) {
            this.id = id; this.title = title; this.file = file; this.favorite = favorite; this.added = added;
        }
    }

    private static class SimpleTextWatcher implements android.text.TextWatcher {
        private final Runnable onChanged;
        SimpleTextWatcher(Runnable onChanged) { this.onChanged = onChanged; }
        @Override public void beforeTextChanged(CharSequence s, int start, int count, int after) {}
        @Override public void onTextChanged(CharSequence s, int start, int before, int count) { onChanged.run(); }
        @Override public void afterTextChanged(android.text.Editable s) {}
    }
}
