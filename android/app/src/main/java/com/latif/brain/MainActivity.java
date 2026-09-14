package com.latif.brain;

import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.provider.OpenableColumns;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.view.Gravity;
import android.view.View;
import android.view.Window;
import android.widget.Button;
import android.widget.EditText;
import android.widget.HorizontalScrollView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public class MainActivity extends Activity {
    private static final int IMPORT_TEXT = 2001;
    private static final int BG = Color.rgb(7, 11, 20);
    private static final int PANEL = Color.rgb(16, 23, 42);
    private static final int PANEL_2 = Color.rgb(24, 33, 56);
    private static final int TEXT = Color.rgb(244, 247, 255);
    private static final int MUTED = Color.rgb(150, 163, 186);
    private static final int PURPLE = Color.rgb(139, 92, 246);
    private static final int CYAN = Color.rgb(56, 189, 248);

    private final List<Book> books = new ArrayList<>();
    private final List<String> chunks = new ArrayList<>();
    private LinearLayout listBox;
    private EditText search;
    private TextView playerTitle, playerState, libraryCount;
    private Button playPause, favoriteButton, rateButton;
    private TextToSpeech tts;
    private Book currentBook;
    private int currentChunk = 0;
    private boolean playing = false;
    private float speechRate = 1.0f;
    private String filterMode = "all";

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        Window w = getWindow();
        w.setStatusBarColor(BG);
        w.setNavigationBarColor(BG);
        speechRate = getPreferences(MODE_PRIVATE).getFloat("speech_rate", 1.0f);
        loadBooks();
        buildUi();
        initTts();
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
        TextView brand = label("LATIF BRAIN", 25, TEXT, true);
        TextView tagline = label("Your private listening & learning library", 12, MUTED, false);
        brandText.addView(brand); brandText.addView(tagline);
        brandRow.addView(brandText, new LinearLayout.LayoutParams(0, -2, 1));
        TextView local = label("LOCAL", 11, Color.rgb(167,243,208), true);
        local.setGravity(Gravity.CENTER);
        local.setPadding(dp(10),dp(7),dp(10),dp(7));
        local.setBackground(round(Color.rgb(10,55,48), dp(18), Color.rgb(20,110,88)));
        brandRow.addView(local);
        root.addView(brandRow);

        TextView hero = label("Books that speak.\nMinds that grow.", 29, TEXT, true);
        hero.setPadding(0, dp(22), 0, dp(4));
        root.addView(hero);
        TextView sub = label("Import text, search your library, save favorites and listen completely offline.", 14, MUTED, false);
        sub.setPadding(0,0,0,dp(16));
        root.addView(sub);

        search = new EditText(this);
        search.setHint("Search titles or book text…");
        search.setHintTextColor(MUTED);
        search.setTextColor(TEXT);
        search.setSingleLine(true);
        search.setPadding(dp(16),0,dp(16),0);
        search.setBackground(round(PANEL, dp(16), Color.rgb(49,62,89)));
        root.addView(search, lp(-1, dp(52)));
        search.addTextChangedListener(new SimpleTextWatcher(() -> renderBooks()));

        LinearLayout actions = new LinearLayout(this);
        actions.setPadding(0,dp(12),0,dp(8));
        Button importBtn = action("＋ IMPORT TXT", PURPLE);
        importBtn.setOnClickListener(v -> chooseText());
        actions.addView(importBtn, new LinearLayout.LayoutParams(0,dp(46),1));
        Button listenBtn = action("▶ CONTINUE", Color.rgb(30,80,110));
        LinearLayout.LayoutParams l2 = new LinearLayout.LayoutParams(0,dp(46),1); l2.setMarginStart(dp(10));
        actions.addView(listenBtn,l2);
        listenBtn.setOnClickListener(v -> continueListening());
        root.addView(actions);

        HorizontalScrollView chipsScroll = new HorizontalScrollView(this);
        chipsScroll.setHorizontalScrollBarEnabled(false);
        LinearLayout chips = new LinearLayout(this);
        chips.setPadding(0,dp(2),0,dp(8));
        chips.addView(chip("All", "all"));
        chips.addView(chip("Favorites", "favorites"));
        chips.addView(chip("Recent", "recent"));
        libraryCount = label("", 12, MUTED, false);
        libraryCount.setGravity(Gravity.CENTER_VERTICAL);
        libraryCount.setPadding(dp(12),0,0,0);
        chips.addView(libraryCount);
        chipsScroll.addView(chips);
        root.addView(chipsScroll, lp(-1, dp(50)));

        ScrollView scroll = new ScrollView(this);
        listBox = new LinearLayout(this);
        listBox.setOrientation(LinearLayout.VERTICAL);
        listBox.setPadding(0,0,0,dp(10));
        scroll.addView(listBox);
        root.addView(scroll, new LinearLayout.LayoutParams(-1,0,1));

        LinearLayout player = new LinearLayout(this);
        player.setOrientation(LinearLayout.VERTICAL);
        player.setPadding(dp(14),dp(11),dp(14),dp(11));
        player.setBackground(round(PANEL, dp(20), Color.rgb(64,52,105)));
        playerTitle = label("Nothing playing", 15, TEXT, true);
        playerTitle.setMaxLines(1);
        playerState = label("Choose a book to start listening", 11, MUTED, false);
        player.addView(playerTitle); player.addView(playerState);
        LinearLayout controls = new LinearLayout(this);
        controls.setGravity(Gravity.CENTER_VERTICAL);
        playPause = action("▶ PLAY", PURPLE);
        playPause.setOnClickListener(v -> togglePlayback());
        controls.addView(playPause, new LinearLayout.LayoutParams(0,dp(44),1));
        favoriteButton = action("☆", PANEL_2);
        LinearLayout.LayoutParams cp = new LinearLayout.LayoutParams(dp(54),dp(44)); cp.setMarginStart(dp(8));
        controls.addView(favoriteButton,cp);
        favoriteButton.setOnClickListener(v -> toggleCurrentFavorite());
        rateButton = action(String.format(Locale.US,"%.1fx",speechRate), PANEL_2);
        LinearLayout.LayoutParams rp = new LinearLayout.LayoutParams(dp(72),dp(44)); rp.setMarginStart(dp(8));
        controls.addView(rateButton,rp);
        rateButton.setOnClickListener(v -> cycleRate());
        player.addView(controls);
        root.addView(player);

        setContentView(root);
        renderBooks();
    }

    private void initTts() {
        tts = new TextToSpeech(this, status -> {
            if (status == TextToSpeech.SUCCESS) {
                int lang = tts.setLanguage(Locale.getDefault());
                tts.setSpeechRate(speechRate);
                if (lang == TextToSpeech.LANG_MISSING_DATA || lang == TextToSpeech.LANG_NOT_SUPPORTED) {
                    tts.setLanguage(Locale.US);
                }
                tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                    @Override public void onStart(String id) { runOnUiThread(() -> updatePlayer()); }
                    @Override public void onError(String id) { runOnUiThread(() -> { playing=false; updatePlayer(); toast("Speech engine could not read this section."); }); }
                    @Override public void onDone(String id) {
                        if (!playing || currentBook == null) return;
                        currentChunk++;
                        saveProgress();
                        if (currentChunk < chunks.size()) speakCurrent();
                        else runOnUiThread(() -> { playing=false; currentChunk=0; saveProgress(); updatePlayer(); toast("Book finished"); });
                    }
                });
            } else toast("Text-to-speech is unavailable on this device.");
        });
    }

    private void chooseText() {
        Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        i.addCategory(Intent.CATEGORY_OPENABLE);
        i.setType("text/*");
        startActivityForResult(i, IMPORT_TEXT);
    }

    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request,result,data);
        if (request != IMPORT_TEXT || result != RESULT_OK || data == null || data.getData() == null) return;
        Uri uri = data.getData();
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
        try (Cursor c = getContentResolver().query(uri, new String[]{OpenableColumns.DISPLAY_NAME}, null,null,null)) {
            if (c != null && c.moveToFirst()) return c.getString(0);
        } catch (Exception ignored) {}
        return "Imported book";
    }

    private byte[] readLimited(InputStream in, int limit) throws Exception {
        if (in == null) throw new Exception("No stream");
        try (InputStream src=in; ByteArrayOutputStream out=new ByteArrayOutputStream()) {
            byte[] b=new byte[8192]; int n,total=0;
            while ((n=src.read(b))>0) { total+=n; if(total>limit) throw new Exception("Too large"); out.write(b,0,n); }
            return out.toByteArray();
        }
    }

    private void addBook(String title, String text) throws Exception {
        String id = "book_" + System.currentTimeMillis();
        File f = new File(getFilesDir(), id + ".txt");
        try(FileOutputStream out=new FileOutputStream(f)) { out.write(text.getBytes(StandardCharsets.UTF_8)); }
        Book b = new Book(id,title,f.getName(),false,System.currentTimeMillis());
        books.add(0,b); saveBooks(); renderBooks(); selectBook(b,false);
    }

    private void loadBooks() {
        books.clear();
        try {
            File meta=new File(getFilesDir(),"books.json");
            if(meta.exists()) {
                String raw=readFile(meta);
                JSONArray a=new JSONArray(raw);
                for(int i=0;i<a.length();i++) {
                    JSONObject o=a.getJSONObject(i);
                    File f=new File(getFilesDir(),o.getString("file"));
                    if(f.exists()) books.add(new Book(o.getString("id"),o.getString("title"),o.getString("file"),o.optBoolean("favorite"),o.optLong("added",0)));
                }
            }
        } catch(Exception ignored) {}
        if(books.isEmpty()) seedWelcome();
    }

    private void seedWelcome() {
        String intro = "Welcome to LATIF BRAIN.\n\nThis private library lives on your device. Import a plain text book, choose Listen, and LATIF BRAIN will read it using the speech engine installed on your phone. Your books, favorites, playback position, and listening speed remain local.\n\nUse search to find a title or words inside a book. Mark important books as favorites. Stop anywhere and Continue will return to the saved section.\n\nThis first book is only a guide. Delete it whenever you want and make this library yours.";
        try { addBook("Welcome to LATIF BRAIN", intro); } catch(Exception ignored) {}
    }

    private void saveBooks() {
        try {
            JSONArray a=new JSONArray();
            for(Book b:books) {
                JSONObject o=new JSONObject();
                o.put("id",b.id); o.put("title",b.title); o.put("file",b.file); o.put("favorite",b.favorite); o.put("added",b.added);
                a.put(o);
            }
            try(FileOutputStream out=new FileOutputStream(new File(getFilesDir(),"books.json"))) { out.write(a.toString().getBytes(StandardCharsets.UTF_8)); }
        } catch(Exception ignored) {}
    }

    private void renderBooks() {
        if(listBox==null) return;
        listBox.removeAllViews();
        String q=search==null?"":search.getText().toString().trim().toLowerCase(Locale.ROOT);
        int shown=0;
        List<Book> source=new ArrayList<>(books);
        if("recent".equals(filterMode)) source.sort((a,b)->Long.compare(b.added,a.added));
        for(Book b:source) {
            if("favorites".equals(filterMode) && !b.favorite) continue;
            if(!q.isEmpty() && !matches(b,q)) continue;
            shown++; listBox.addView(bookCard(b));
        }
        if(libraryCount!=null) libraryCount.setText(shown + (shown==1?" book":" books"));
        if(shown==0) {
            TextView empty=label("No books match this view.\nImport a TXT file to add one.",14,MUTED,false);
            empty.setGravity(Gravity.CENTER); empty.setPadding(0,dp(44),0,dp(44)); listBox.addView(empty);
        }
    }

    private boolean matches(Book b,String q) {
        if(b.title.toLowerCase(Locale.ROOT).contains(q)) return true;
        try {
            String t=readFile(new File(getFilesDir(),b.file));
            if(t.length()>180000) t=t.substring(0,180000);
            return t.toLowerCase(Locale.ROOT).contains(q);
        } catch(Exception e){return false;}
    }

    private View bookCard(Book b) {
        LinearLayout card=new LinearLayout(this); card.setOrientation(LinearLayout.VERTICAL); card.setPadding(dp(15),dp(13),dp(15),dp(13));
        card.setBackground(round(PANEL,dp(17),Color.rgb(42,52,77)));
        LinearLayout.LayoutParams box=new LinearLayout.LayoutParams(-1,-2); box.setMargins(0,0,0,dp(10)); card.setLayoutParams(box);
        TextView title=label((b.favorite?"★  ":"")+b.title,16,TEXT,true); card.addView(title);
        int p=getPreferences(MODE_PRIVATE).getInt("progress_"+b.id,0);
        TextView meta=label(p>0?"Saved listening position • offline":"Ready offline • stored on this device",11,MUTED,false); meta.setPadding(0,dp(4),0,dp(10)); card.addView(meta);
        LinearLayout row=new LinearLayout(this);
        Button listen=action(currentBook==b?"NOW PLAYING":"▶ LISTEN", currentBook==b?Color.rgb(35,102,115):PURPLE);
        listen.setOnClickListener(v->selectBook(b,true)); row.addView(listen,new LinearLayout.LayoutParams(0,dp(42),1));
        Button fav=action(b.favorite?"★":"☆",PANEL_2); LinearLayout.LayoutParams fp=new LinearLayout.LayoutParams(dp(52),dp(42));fp.setMarginStart(dp(8));row.addView(fav,fp);
        fav.setOnClickListener(v->{b.favorite=!b.favorite;saveBooks();renderBooks();if(currentBook==b)updatePlayer();});
        Button del=action("×",PANEL_2); LinearLayout.LayoutParams dpv=new LinearLayout.LayoutParams(dp(52),dp(42));dpv.setMarginStart(dp(8));row.addView(del,dpv);
        del.setOnClickListener(v->deleteBook(b));
        card.addView(row); return card;
    }

    private void deleteBook(Book b) {
        if(currentBook==b){ if(tts!=null)tts.stop(); currentBook=null; playing=false; chunks.clear(); }
        new File(getFilesDir(),b.file).delete(); books.remove(b); getPreferences(MODE_PRIVATE).edit().remove("progress_"+b.id).apply(); saveBooks(); renderBooks(); updatePlayer();
    }

    private void selectBook(Book b, boolean autoPlay) {
        if(currentBook!=b && tts!=null) tts.stop();
        currentBook=b; chunks.clear();
        try { chunks.addAll(splitForSpeech(readFile(new File(getFilesDir(),b.file)))); } catch(Exception e){toast("Book file is unavailable.");return;}
        currentChunk=Math.min(getPreferences(MODE_PRIVATE).getInt("progress_"+b.id,0),Math.max(0,chunks.size()-1));
        playing=false; renderBooks(); updatePlayer(); if(autoPlay) togglePlayback();
    }

    private void continueListening() {
        Book best=null; int progress=-1;
        for(Book b:books){int p=getPreferences(MODE_PRIVATE).getInt("progress_"+b.id,0);if(p>progress){progress=p;best=b;}}
        if(best==null && !books.isEmpty()) best=books.get(0);
        if(best!=null) selectBook(best,true); else toast("Import a book first.");
    }

    private void togglePlayback() {
        if(currentBook==null){continueListening();return;}
        if(tts==null){toast("Speech engine is still starting.");return;}
        if(playing){tts.stop();playing=false;saveProgress();updatePlayer();}
        else {playing=true;speakCurrent();updatePlayer();}
    }

    private void speakCurrent() {
        if(!playing||tts==null||currentBook==null||chunks.isEmpty())return;
        if(currentChunk>=chunks.size())currentChunk=0;
        tts.setSpeechRate(speechRate);
        String id=currentBook.id+"_"+currentChunk;
        int r=tts.speak(chunks.get(currentChunk),TextToSpeech.QUEUE_FLUSH,null,id);
        if(r==TextToSpeech.ERROR){playing=false;runOnUiThread(()->{updatePlayer();toast("Speech engine failed to start.");});}
        runOnUiThread(this::updatePlayer);
    }

    private List<String> splitForSpeech(String raw) {
        ArrayList<String> out=new ArrayList<>(); String text=raw.replace("\r","").trim(); int max=2800, start=0;
        while(start<text.length()){
            int end=Math.min(text.length(),start+max);
            if(end<text.length()){
                int cut=text.lastIndexOf(' ',end); int para=text.lastIndexOf('\n',end);
                cut=Math.max(cut,para); if(cut>start+800)end=cut;
            }
            String s=text.substring(start,end).trim(); if(!s.isEmpty())out.add(s); start=end;
        }
        if(out.isEmpty())out.add("This book has no readable text."); return out;
    }

    private void saveProgress(){if(currentBook!=null)getPreferences(MODE_PRIVATE).edit().putInt("progress_"+currentBook.id,currentChunk).apply();}

    private void toggleCurrentFavorite(){if(currentBook==null)return;currentBook.favorite=!currentBook.favorite;saveBooks();renderBooks();updatePlayer();}

    private void cycleRate(){
        if(speechRate<0.8f)speechRate=0.8f; else if(speechRate<1.0f)speechRate=1.0f; else if(speechRate<1.25f)speechRate=1.25f; else if(speechRate<1.5f)speechRate=1.5f; else if(speechRate<1.75f)speechRate=1.75f; else speechRate=0.75f;
        getPreferences(MODE_PRIVATE).edit().putFloat("speech_rate",speechRate).apply(); if(tts!=null)tts.setSpeechRate(speechRate); updatePlayer();
        if(playing){tts.stop();speakCurrent();}
    }

    private void updatePlayer(){
        if(playerTitle==null)return;
        if(currentBook==null){playerTitle.setText("Nothing playing");playerState.setText("Choose a book to start listening");playPause.setText("▶ PLAY");favoriteButton.setText("☆");}
        else {
            playerTitle.setText(currentBook.title); int pct=chunks.isEmpty()?0:(int)(100.0*currentChunk/Math.max(1,chunks.size()));
            playerState.setText((playing?"Listening":"Paused")+" • "+pct+"% • on-device speech"); playPause.setText(playing?"Ⅱ PAUSE":"▶ PLAY"); favoriteButton.setText(currentBook.favorite?"★":"☆");
        }
        rateButton.setText(String.format(Locale.US,"%.2gx",speechRate));
    }

    private Button chip(String text,String mode){Button b=action(text,PANEL_2);LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-2,dp(38));p.setMarginEnd(dp(7));b.setLayoutParams(p);b.setOnClickListener(v->{filterMode=mode;renderBooks();});return b;}
    private Button action(String text,int color){Button b=new Button(this);b.setText(text);b.setTextColor(TEXT);b.setTextSize(12);b.setTypeface(Typeface.DEFAULT,Typeface.BOLD);b.setAllCaps(false);b.setGravity(Gravity.CENTER);b.setPadding(dp(10),0,dp(10),0);b.setBackground(round(color,dp(13),Color.TRANSPARENT));return b;}
    private TextView label(String text,float size,int color,boolean bold){TextView v=new TextView(this);v.setText(text);v.setTextSize(size);v.setTextColor(color);if(bold)v.setTypeface(Typeface.DEFAULT,Typeface.BOLD);return v;}
    private GradientDrawable round(int color,int radius,int stroke){GradientDrawable g=new GradientDrawable();g.setColor(color);g.setCornerRadius(radius);if(stroke!=Color.TRANSPARENT)g.setStroke(dp(1),stroke);return g;}
    private LinearLayout.LayoutParams lp(int w,int h){return new LinearLayout.LayoutParams(w,h);}
    private int dp(int n){return (int)(n*getResources().getDisplayMetrics().density+0.5f);}
    private void toast(String s){runOnUiThread(()->Toast.makeText(this,s,Toast.LENGTH_SHORT).show());}

    private String readFile(File f)throws Exception{try(FileInputStream in=new FileInputStream(f);ByteArrayOutputStream out=new ByteArrayOutputStream()){byte[] b=new byte[8192];int n;while((n=in.read(b))>0)out.write(b,0,n);return out.toString("UTF-8");}}

    @Override protected void onDestroy(){if(tts!=null){tts.stop();tts.shutdown();}super.onDestroy();}
    @Override protected void onPause(){saveProgress();super.onPause();}

    static class Book {String id,title,file;boolean favorite;long added;Book(String i,String t,String f,boolean fav,long a){id=i;title=t;file=f;favorite=fav;added=a;}}
    static class SimpleTextWatcher implements android.text.TextWatcher {private final Runnable r;SimpleTextWatcher(Runnable x){r=x;}public void beforeTextChanged(CharSequence s,int st,int c,int a){}public void onTextChanged(CharSequence s,int st,int b,int c){r.run();}public void afterTextChanged(android.text.Editable e){}}
}
