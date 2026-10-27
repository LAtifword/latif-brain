package com.latif.suite

import android.content.Context
import android.webkit.JavascriptInterface
import org.json.JSONObject
import java.io.File

/**
 * A narrow, deterministic executor for a real app-building action.
 * Does not interpret arbitrary model text as code, execute shell commands,
 * install packages or grant permissions. Project lives in app-private storage.
 */
class NiProjectBridge(private val context: Context) {
    private val root = File(context.filesDir, "generated-projects")
    private val musicPlayer = File(root, "music-player")
    private val html = """<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>LATIF Music Player</title><style>
:root{color-scheme:dark;font-family:system-ui}*{box-sizing:border-box}body{margin:0;background:linear-gradient(145deg,#111b37,#10121e);color:#f3f6ff;min-height:100vh;padding:24px}
main{max-width:620px;margin:auto}h1{font-size:30px}p{color:#aab8d0}.card{border:1px solid #35446a;border-radius:24px;background:#1c2740;padding:22px}
button,label{border:1px solid #6078b4;background:#334b84;color:#fff;padding:12px 15px;border-radius:12px;cursor:pointer}
button:focus-visible,label:focus-visible{outline:3px solid #93dafa}.controls{display:flex;gap:8px;flex-wrap:wrap;margin:18px 0}
input[type=range]{width:100%}#songs{list-style:none;padding:0}#songs button{display:block;width:100%;text-align:left;margin:7px 0}
small{color:#b6c8e5}#now{overflow-wrap:anywhere}
</style></head><body><main><h1>♫ LATIF Music Player</h1>
<p>A working, offline music player. Select local audio files; no upload or cloud service.</p>
<section class="card"><label for="files">Choose audio files</label>
<input id="files" type="file" accept="audio/*" multiple style="position:absolute;left:-9999px">
<h2 id="now">No song selected</h2><audio id="audio" preload="metadata"></audio>
<div class="controls"><button id="prev">⏮ Previous</button><button id="play">▶ Play</button><button id="next">Next ⏭</button></div>
<label for="seek">Progress</label><input id="seek" type="range" min="0" max="1000" value="0">
<small id="time">0:00 / 0:00</small>
<label for="volume">Volume</label><input id="volume" type="range" min="0" max="1" step=".01" value=".8">
<h3>Playlist</h3><ul id="songs"></ul><p id="status" role="status">Ready.</p></section>
</main><script>
'use strict';
const audio=document.querySelector('#audio'),files=document.querySelector('#files'),list=document.querySelector('#songs');
const now=document.querySelector('#now'),play=document.querySelector('#play'),seek=document.querySelector('#seek');
const time=document.querySelector('#time'),status=document.querySelector('#status');
let songs=[],index=-1;
const stamp=s=>Number.isFinite(s)?Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0'):'0:00';
function select(i,autoplay=true){if(i<0||i>=songs.length)return;index=i;audio.src=songs[i].url;now.textContent=songs[i].name;render();if(autoplay)audio.play().catch(e=>status.textContent=e.message);}
function render(){list.replaceChildren();songs.forEach((s,i)=>{const li=document.createElement('li');const b=document.createElement('button');b.textContent=(i===index?'♪ ':'')+s.name;b.onclick=()=>select(i);li.appendChild(b);list.appendChild(li);});}
function move(delta){if(songs.length)select((index+delta+songs.length)%songs.length);}
files.onchange=()=>{songs.forEach(s=>URL.revokeObjectURL(s.url));songs=[...files.files].filter(f=>f.type.startsWith('audio/')||/\.(mp3|m4a|wav|ogg|flac|aac)$/i.test(f.name)).map(f=>({name:f.name,url:URL.createObjectURL(f)}));index=-1;audio.pause();audio.removeAttribute('src');audio.load();now.textContent='No song selected';render();status.textContent=songs.length+' audio file(s) loaded locally';if(songs.length)select(0,false);};
document.querySelector('#prev').onclick=()=>move(-1);
document.querySelector('#next').onclick=()=>move(1);
play.onclick=()=>{if(!audio.src&&songs.length)select(0,false);if(audio.paused)audio.play().catch(e=>status.textContent=e.message);else audio.pause();};
audio.onplay=()=>{play.textContent='⏸ Pause';status.textContent='Playing';};
audio.onpause=()=>{play.textContent='▶ Play';};
audio.onended=()=>move(1);
audio.ontimeupdate=()=>{seek.value=audio.duration?String(Math.round(audio.currentTime/audio.duration*1000)):'0';time.textContent=stamp(audio.currentTime)+' / '+stamp(audio.duration);};
seek.oninput=()=>{if(Number.isFinite(audio.duration))audio.currentTime=Number(seek.value)/1000*audio.duration;};
document.querySelector('#volume').oninput=e=>audio.volume=Number(e.target.value);
audio.volume=.8;audio.onerror=()=>status.textContent='Cannot decode this audio format on this device';
window.addEventListener('pagehide',()=>{audio.pause();songs.forEach(s=>URL.revokeObjectURL(s.url));});
</script></body></html>"""

    @JavascriptInterface
    fun createMusicPlayer(): String {
        return try {
            check(musicPlayer.canonicalPath.startsWith(root.canonicalPath + File.separator))
            check(musicPlayer.mkdirs() || musicPlayer.isDirectory)
            val target = File(musicPlayer, "index.html")
            // Atomic replacement; never accept model-provided filesystem paths.
            val temp = File(musicPlayer, "index.html.tmp")
            temp.writeText(html, Charsets.UTF_8)
            if (target.exists()) check(target.delete())
            check(temp.renameTo(target))
            JSONObject().put("ok", true).put("name", "LATIF Music Player")
                .put("url", "https://appassets.androidplatform.net/generated/music-player/index.html")
                .put("path", "generated-projects/music-player/index.html")
                .put("files", 1).toString()
        } catch (e: Exception) {
            JSONObject().put("ok", false).put("error", e.message ?: "Cannot create project").toString()
        }
    }

    @JavascriptInterface
    fun projectStatus(): String {
        val target = File(musicPlayer, "index.html")
        return JSONObject().put("musicPlayerCreated", target.isFile)
            .put("bytes", if (target.isFile) target.length() else 0)
            .toString()
    }
}
