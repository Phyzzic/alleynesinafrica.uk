const DATA_URL = "data/students.json";
const PLACEHOLDER_NAME = /^student\s*0*\d+$/i;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const money = (n) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(Number(n) || 0);

// Treats empty strings and the word BLANK as "nothing here"
const clean = (value) => {
  const v = String(value ?? "").trim();
  return /^blank$/i.test(v) ? "" : v;
};

// Only real http(s) links count; "#" and "#donate" are treated as not set yet
const safeLink = (url) => {
  const u = clean(url);
  if (!u || u === "#" || u === "#donate") return null;
  try {
    const parsed = new URL(u, location.href);
    return /^https?:$/.test(parsed.protocol) ? parsed.href : null;
  } catch {
    return null;
  }
};

const percent = (raised, target) =>
  target > 0 ? Math.min(100, Math.round((raised / target) * 100)) : 0;

const initials = (name) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key === "style") {
      for (const [prop, val] of Object.entries(value)) node.style.setProperty(prop, val);
    } else node.setAttribute(key, value);
  }
  node.append(...children.flat().filter((c) => c != null));
  return node;
}

/* Scroll reveal ---------------------------------------------------- */

const revealer =
  "IntersectionObserver" in window
    ? new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            entry.target.classList.add("in");
            revealer.unobserve(entry.target);
          }
        },
        { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
      )
    : null;

function reveal(node) {
  if (revealer) revealer.observe(node);
  else node.classList.add("in");
}

/* Nav and mobile menu ---------------------------------------------- */

function setupNav() {
  const nav = $("#nav");
  const burger = $("#burger");
  const menu = $("#menu");

  const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 24);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  const setOpen = (open) => {
    menu.hidden = !open;
    burger.classList.toggle("is-open", open);
    burger.setAttribute("aria-expanded", String(open));
    burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    document.body.classList.toggle("menu-open", open);
    if (open) $("a", menu)?.focus();
  };

  burger.addEventListener("click", () => setOpen(menu.hidden));
  $$("[data-menu-link]", menu).forEach((link) =>
    link.addEventListener("click", () => setOpen(false))
  );

  window.addEventListener("keydown", (e) => {
    if (menu.hidden) return;
    if (e.key === "Escape") {
      setOpen(false);
      burger.focus();
    }
    if (e.key === "Tab") {
      const stops = [burger, ...$$("a", menu)];
      const first = stops[0];
      const last = stops[stops.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  window.matchMedia("(min-width: 981px)").addEventListener("change", (e) => {
    if (e.matches) setOpen(false);
  });

  // Underline the nav link for whichever section is in the middle of the screen
  if (!("IntersectionObserver" in window)) return;
  const links = new Map($$(".nav__links a").map((a) => [a.getAttribute("href"), a]));
  const spy = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        links.forEach((a) => a.classList.remove("is-active"));
        links.get(`#${entry.target.id}`)?.classList.add("is-active");
      }
    },
    { rootMargin: "-45% 0px -50% 0px" }
  );
  ["journey", "fund", "students", "connect"].forEach((id) => {
    const section = document.getElementById(id);
    if (section) spy.observe(section);
  });
  const hero = document.getElementById("top");
  if (hero) {
    new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) links.forEach((a) => a.classList.remove("is-active"));
      },
      { rootMargin: "-45% 0px -50% 0px" }
    ).observe(hero);
  }
}

/* Group fund ------------------------------------------------------- */

function setText(node, value) {
  const text = clean(value);
  node.textContent = text;
  node.hidden = !text;
}

function countUp(node, to, format) {
  if (reduceMotion || to <= 0) {
    node.textContent = format(to);
    return;
  }
  const start = performance.now();
  const duration = 1400;
  const tick = (now) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 4);
    node.textContent = format(Math.round(to * eased));
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function renderGroup(group = {}) {
  const raised = Number(group.raised) || 0;
  const target = Number(group.target) || 0;
  const supporters = Number(group.supporters) || 0;
  const pct = percent(raised, target);

  setText($("#group-title"), group.title);
  setText($("#group-tagline"), group.tagline);
  setText($("#group-update"), group.update);

  const donate = $("#group-donate");
  const link = safeLink(group.donateUrl);
  if (link) {
    donate.href = link;
    donate.target = "_blank";
    donate.rel = "noopener noreferrer";
    $("#dock-link").href = link;
    $("#dock-link").target = "_blank";
    $("#dock-link").rel = "noopener noreferrer";
  } else {
    donate.classList.add("is-disabled");
    donate.removeAttribute("href");
    donate.setAttribute("aria-disabled", "true");
    donate.textContent = "Link coming soon";
  }

  const hasTarget = target > 0;
  $("#group-progress-wrap").hidden = !hasTarget;
  $("#group-target").parentElement.hidden = !hasTarget;
  $("#group-card").classList.toggle("is-open-target", !hasTarget);

  const track = $("#group-track");
  track.style.setProperty("--pct", `${pct}%`);
  track.setAttribute("aria-valuenow", String(pct));
  $("#group-percent").textContent = `${pct}% funded`;
  $("#group-remaining").textContent = `${money(Math.max(0, target - raised))} to go`;
  $("#group-target").textContent = money(target);
  $("#group-raised").textContent = money(0);
  $("#group-supporters").textContent = "0";

  const card = $("#group-card");
  const run = () => {
    track.classList.add("in");
    countUp($("#group-raised"), raised, money);
    countUp($("#group-supporters"), supporters, String);
  };
  if (!("IntersectionObserver" in window)) return run();
  const once = new IntersectionObserver(
    (entries) => {
      if (!entries[0].isIntersecting) return;
      once.disconnect();
      run();
    },
    { threshold: 0.35 }
  );
  once.observe(card);
}

/* Students --------------------------------------------------------- */

function studentCard(student, index) {
  const name = clean(student.label);
  const year = clean(student.year);
  const focus = clean(student.focus);
  const bio = clean(student.bio);
  const photo = safeLink(student.photo) || clean(student.photo);
  const raised = Number(student.raised) || 0;
  const target = Number(student.target) || 0;
  const pct = percent(raised, target);
  const link = safeLink(student.donateUrl);
  const meta = [year, focus].filter(Boolean).join(" · ");
  const first = name.split(/\s+/)[0];

  const avatar = el(
    "div",
    { class: "card__avatar", "aria-hidden": "true" },
    photo ? el("img", { src: photo, alt: "", loading: "lazy" }) : initials(name)
  );

  const button = link
    ? el("a", {
        class: "btn btn--outline btn--block",
        href: link,
        target: "_blank",
        rel: "noopener noreferrer",
        "aria-label": `Sponsor ${name}`,
        text: `Sponsor ${first}`,
      })
    : el("span", {
        class: "btn btn--outline btn--block is-disabled",
        "aria-disabled": "true",
        text: "Link coming soon",
      });

  const card = el(
    "article",
    { class: "card reveal", style: { "--i": String(index % 3), "--pct": `${pct}%` } },
    el(
      "div",
      { class: "card__top" },
      avatar,
      el(
        "div",
        {},
        el("h3", { class: "card__name", text: name }),
        meta ? el("span", { class: "card__meta", text: meta }) : null
      )
    ),
    bio ? el("p", { class: "card__bio", text: bio }) : el("div", { class: "card__spacer" }),
    target > 0
      ? el(
          "div",
          {},
          el(
            "div",
            {
              class: "track track--sm",
              role: "progressbar",
              "aria-label": `${name} fundraising progress`,
              "aria-valuemin": "0",
              "aria-valuemax": "100",
              "aria-valuenow": String(pct),
            },
            el("div", { class: "track__fill" })
          ),
          el(
            "p",
            { class: "card__funds" },
            el("span", { text: `${money(raised)} raised` }),
            el("span", { text: `of ${money(target)}` })
          )
        )
      : null,
    button
  );
  card.dataset.search = [name, year, focus].join(" ").toLowerCase();
  return card;
}

function setupStudents(all) {
  const grid = $("#student-grid");
  const count = $("#student-count");
  const empty = $("#student-empty");
  const input = $("#student-search");
  const showAll = new URLSearchParams(location.search).has("all");

  // Unnamed placeholder slots stay hidden until a real name is added.
  // Add ?all to the address to preview every slot while editing.
  const students = all.filter((s) => {
    const name = clean(s.label);
    return showAll ? true : name && !PLACEHOLDER_NAME.test(name);
  });

  if (!students.length) {
    $(".toolbar .search").hidden = true;
    count.hidden = true;
    empty.hidden = false;
    empty.textContent = "Individual fundraisers are being set up. Check back soon.";
    return;
  }

  const cards = students.map((s, i) => {
    const card = studentCard(
      { ...s, label: clean(s.label) || `Student ${i + 1}` },
      i
    );
    grid.append(card);
    reveal(card);
    return card;
  });

  const update = () => {
    const q = input.value.trim().toLowerCase();
    let shown = 0;
    for (const card of cards) {
      const match = !q || card.dataset.search.includes(q);
      card.hidden = !match;
      if (match) shown += 1;
    }
    count.textContent =
      shown === cards.length
        ? `${cards.length} ${cards.length === 1 ? "student" : "students"} fundraising`
        : `Showing ${shown} of ${cards.length}`;
    empty.hidden = shown > 0;
    empty.textContent = `No one called “${input.value.trim()}” yet.`;
  };

  input.addEventListener("input", update);
  update();
}

/* Socials ---------------------------------------------------------- */

function setupSocials(socials = {}) {
  for (const key of ["instagram", "facebook"]) {
    const node = $(`#social-${key}`);
    const link = safeLink(socials[key]);
    if (link) {
      node.href = link;
      node.hidden = false;
    }
  }
  const visible = $$(".social").some((n) => !n.hidden);
  $("#connect").hidden = !visible;
}

/* Mobile donate bar ------------------------------------------------ */

function setupDock() {
  const dock = $("#dock");
  if (!("IntersectionObserver" in window)) return;
  const inView = new Set();
  const update = () => dock.classList.toggle("is-on", inView.size === 0 && window.scrollY > 200);
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) inView.add(e.target.id);
      else inView.delete(e.target.id);
    }
    update();
  });
  io.observe($("#top"));
  io.observe($("#fund"));
  window.addEventListener("scroll", update, { passive: true });
}

/* Start ------------------------------------------------------------ */

setupNav();
setupDock();
$$(".reveal").forEach(reveal);

fetch(DATA_URL, { cache: "no-store" })
  .then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  })
  .then((data) => {
    renderGroup(data.group);
    setupStudents(data.students || []);
    setupSocials(data.socials);
  })
  .catch(() => {
    $("#student-count").hidden = true;
    $("#student-grid").replaceChildren(
      el("p", {
        class: "empty",
        text: "Couldn’t load data/students.json. If you opened index.html straight from your files, run it through a local server or upload the folder to your host.",
      })
    );
  });