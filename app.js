const THEMES={
dark:{bg:"#0b1020",card:"#121a33",muted:"#9fb0d0",text:"#e8eefc",accent:"#66d9ff",danger:"#ff6b6b"},
purple:{bg:"#120b20",card:"#1a1233",muted:"#b6a9d0",text:"#f0ebff",accent:"#b88cff",danger:"#ff7a7a"},
green:{bg:"#0b1a14",card:"#0f2a1f",muted:"#8fd1b5",text:"#eafff6",accent:"#6dffb3",danger:"#ff6b6b"},
light:{bg:"#f5f7fb",card:"#ffffff",muted:"#5f6c85",text:"#1a1f2e",accent:"#2f7cff",danger:"#d92d20"}
};

const themeSelect=document.getElementById("themeSelect");

function applyTheme(name){
 const t=THEMES[name];
 if(!t)return;
 const r=document.documentElement.style;
 r.setProperty("--bg",t.bg);
 r.setProperty("--card",t.card);
 r.setProperty("--muted",t.muted);
 r.setProperty("--text",t.text);
 r.setProperty("--accent",t.accent);
 r.setProperty("--danger",t.danger);
 localStorage.setItem("lvn_theme",name);
}

themeSelect.addEventListener("change",()=>applyTheme(themeSelect.value));
const saved=localStorage.getItem("lvn_theme")||"dark";
themeSelect.value=saved;
applyTheme(saved);

// (core quiz logic remains unchanged from v1)
