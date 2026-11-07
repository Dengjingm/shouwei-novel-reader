const state = {
  chapters: [],
  current: 0,
  fontSize: Number(localStorage.getItem("niju-font-size")) || 19,
  theme: localStorage.getItem("niju-theme") || "paper",
};

const readingPositionKey = "niju-stage-v8-current";

function remapLegacyChapterUrl(rawUrl, data) {
  const url = new URL(rawUrl);
  const version = url.searchParams.get("v");
  const mapping = data.legacyChapterMaps?.[version] ??
    (data.legacyVersions?.includes(version) ? data.legacyChapterMap : null);
  if (!mapping) return null;
  const mapped = mapping[url.hash.slice(1)];
  if (mapped) url.hash = mapped;
  url.searchParams.set("v", data.revision);
  return url.href;
}

function migrateReadingPosition(storage, data) {
  const exists = (id) => data.chapters.some((chapter) => chapter.id === id);
  if (exists(storage.getItem(readingPositionKey))) return;
  const previousKeys = [
    ["niju-hunt-v7-current", data.legacyChapterMaps?.["revision-20261105"]],
    ["niju-story-v6-current", data.legacyChapterMaps?.["story-20261103"]],
    ["niju-pursuit-v5-current", data.legacyChapterMaps?.["pursuit-20261103"]],
    ["niju-expanded-v4-current", data.legacyChapterMaps?.["expanded-20261103"]],
    ["niju-complete-v3-current", data.legacyChapterMaps?.["ensemble-20261102"]],
    ["niju-opening-v2-current", data.legacyChapterMap],
  ];
  for (const [key, mapping] of previousKeys) {
    const mapped = mapping?.[storage.getItem(key)];
    if (exists(mapped)) {
      storage.setItem(readingPositionKey, mapped);
      return;
    }
  }
}

const els = {
  body: document.body,
  chapter: document.querySelector("#chapter"),
  hero: document.querySelector("#hero"),
  reader: document.querySelector("#reader"),
  chapterList: document.querySelector("#chapterList"),
  chapterSearch: document.querySelector("#chapterSearch"),
  chapterKicker: document.querySelector("#chapterKicker"),
  chapterTitle: document.querySelector("#chapterTitle"),
  chapterCount: document.querySelector("#chapterCount"),
  chapterBody: document.querySelector("#chapterBody"),
  prev: document.querySelector("#prevChapter"),
  next: document.querySelector("#nextChapter"),
  progress: document.querySelector("#readProgress"),
  sidebar: document.querySelector("#sidebar"),
  overlay: document.querySelector("#overlay"),
  menuButton: document.querySelector("#menuButton"),
  themeButton: document.querySelector("#themeButton"),
  toast: document.querySelector("#toast"),
};

function setTheme(theme) {
  state.theme = theme;
  document.documentElement.dataset.theme = theme;
  els.themeButton.textContent = theme === "night" ? "纸页" : "夜读";
  localStorage.setItem("niju-theme", theme);
}

function setFontSize(size) {
  state.fontSize = Math.max(16, Math.min(25, size));
  document.documentElement.style.setProperty("--reader-size", `${state.fontSize}px`);
  localStorage.setItem("niju-font-size", String(state.fontSize));
  showToast(`正文字号 ${state.fontSize}px`);
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => els.toast.classList.remove("show"), 1400);
}

function closeMenu() {
  els.body.classList.remove("menu-open");
  els.menuButton.setAttribute("aria-expanded", "false");
}

function openMenu() {
  els.body.classList.add("menu-open");
  els.menuButton.setAttribute("aria-expanded", "true");
}

function chapterFromHash() {
  const match = location.hash.match(/^#chapter-(\d{3})$/);
  if (!match) return null;
  const number = Number(match[1]);
  return number >= 1 && number <= state.chapters.length ? number - 1 : null;
}

function renderChapterList(query = "") {
  const needle = query.trim().toLowerCase();
  els.chapterList.replaceChildren();

  state.chapters.forEach((chapter, index) => {
    if (needle && !chapter.title.toLowerCase().includes(needle) && !String(chapter.number).includes(needle)) return;

    const link = document.createElement("a");
    link.href = `#${chapter.id}`;
    link.dataset.index = String(index);
    link.className = index === state.current && !els.chapter.hidden ? "active" : "";

    const number = document.createElement("span");
    number.textContent = String(chapter.number).padStart(2, "0");
    const title = document.createElement("strong");
    title.textContent = chapter.title.replace(/^第.+?章\s*/, "");

    link.append(number, title);
    link.addEventListener("click", closeMenu);
    els.chapterList.append(link);
  });
}

function renderChapter(index, { scroll = true } = {}) {
  const chapter = state.chapters[index];
  if (!chapter) return;

  els.body.classList.remove("cover-mode");
  state.current = index;
  localStorage.setItem(readingPositionKey, chapter.id);
  els.hero.hidden = true;
  els.chapter.hidden = false;
  els.chapterKicker.textContent = `门后的世界 · 第 ${String(chapter.number).padStart(2, "0")} 章`;
  els.chapterTitle.textContent = chapter.title.replace(/^第.+?章\s*/, "");
  els.chapterCount.textContent = `约 ${chapter.characterCount.toLocaleString("zh-CN")} 字`;
  els.chapterBody.replaceChildren();

  chapter.body.split(/\n\s*\n/).forEach((block) => {
    if (block.trim() === "***") {
      const separator = document.createElement("hr");
      separator.className = "scene-break";
      separator.setAttribute("aria-label", "场景转换");
      els.chapterBody.append(separator);
      return;
    }
    const paragraph = document.createElement("p");
    paragraph.textContent = block.replace(/\n/g, " ").trim();
    if (paragraph.textContent) els.chapterBody.append(paragraph);
  });

  els.prev.disabled = index === 0;
  els.next.disabled = index === state.chapters.length - 1;
  els.next.textContent = index === state.chapters.length - 1 ? "本卷已读完" : "下一章 →";
  document.title = `${chapter.title}｜逆局·门后的世界`;
  renderChapterList(els.chapterSearch.value);
  closeMenu();

  if (scroll) window.scrollTo({ top: 0, behavior: "instant" });
  updateProgress();
}

function showCover() {
  els.body.classList.add("cover-mode");
  els.hero.hidden = false;
  els.chapter.hidden = true;
  document.title = "逆局｜简介";
  closeMenu();
  window.scrollTo({ top: 0, behavior: "instant" });
}

function navigate(index) {
  const chapter = state.chapters[index];
  if (!chapter) return;
  if (location.hash === `#${chapter.id}`) renderChapter(index);
  else location.hash = chapter.id;
}

function updateProgress() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const withinChapter = max > 0 ? window.scrollY / max : 0;
  const total = (state.current + withinChapter) / state.chapters.length;
  els.progress.style.width = `${Math.max(0, Math.min(100, total * 100))}%`;
}

async function init() {
  const response = await fetch("./chapters.json?v=threshold-20261107");
  if (!response.ok) throw new Error("正文加载失败");
  const data = await response.json();
  state.chapters = data.chapters;
  document.querySelector(".brand small").textContent = data.subtitle;

  const migratedUrl = remapLegacyChapterUrl(location.href, data);
  if (migratedUrl) history.replaceState(null, "", migratedUrl);
  migrateReadingPosition(localStorage, data);

  setTheme(state.theme);
  setFontSize(state.fontSize);
  renderChapterList();

  const hashIndex = chapterFromHash();
  if (hashIndex !== null) renderChapter(hashIndex, { scroll: false });

  document.querySelector("#startReading").addEventListener("click", () => navigate(0));
  document.querySelector("#fontDown").addEventListener("click", () => setFontSize(state.fontSize - 1));
  document.querySelector("#fontUp").addEventListener("click", () => setFontSize(state.fontSize + 1));
  document.querySelector("#backToTop").addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  els.themeButton.addEventListener("click", () => setTheme(state.theme === "paper" ? "night" : "paper"));
  els.menuButton.addEventListener("click", () => els.body.classList.contains("menu-open") ? closeMenu() : openMenu());
  els.overlay.addEventListener("click", closeMenu);
  els.chapterSearch.addEventListener("input", (event) => renderChapterList(event.target.value));
  els.prev.addEventListener("click", () => navigate(state.current - 1));
  els.next.addEventListener("click", () => navigate(state.current + 1));

  window.addEventListener("hashchange", () => {
    const index = chapterFromHash();
    if (index !== null) renderChapter(index);
    else showCover();
  });
  window.addEventListener("scroll", updateProgress, { passive: true });
  window.addEventListener("keydown", (event) => {
    if (els.chapter.hidden || event.target.matches("input, textarea")) return;
    if (event.key === "ArrowLeft") navigate(state.current - 1);
    if (event.key === "ArrowRight") navigate(state.current + 1);
  });
}

init().catch((error) => {
  els.hero.innerHTML = `<p class="error">${error.message}，请刷新页面重试。</p>`;
});
