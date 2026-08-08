const LINKS = [
  { href: "../index.html", label: "Home", id: "home" },
  { href: "../pikachu/", label: "Pikachu", id: "pikachu" },
  { href: "../games/", label: "Games", id: "games" },
  { href: "../consoles/", label: "Consoles", id: "consoles" },
];

const ROOT_LINKS = [
  { href: "./", label: "Home", id: "home" },
  { href: "./pikachu/", label: "Pikachu", id: "pikachu" },
  { href: "./games/", label: "Games", id: "games" },
  { href: "./consoles/", label: "Consoles", id: "consoles" },
];

export function mountSiteNav({ active, root = false } = {}) {
  const host = document.querySelector("[data-site-nav]");
  if (!host) return;

  const links = root ? ROOT_LINKS : LINKS;
  host.innerHTML = `
    <nav class="site-nav" aria-label="Primary">
      <a class="site-nav-brand" href="${root ? "./" : "../index.html"}">Collection</a>
      <div class="site-nav-links">
        ${links
          .map(
            (link) => `
              <a
                href="${link.href}"
                class="site-nav-link${link.id === active ? " is-active" : ""}"
                ${link.id === active ? 'aria-current="page"' : ""}
              >${link.label}</a>
            `
          )
          .join("")}
      </div>
    </nav>
  `;
}
