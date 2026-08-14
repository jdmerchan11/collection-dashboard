/** Shared detail modal helpers for collection sections. */

export function bindModalChrome(root) {
  if (!root) return;
  const close = () => {
    root.classList.add("hidden");
    document.body.classList.remove("modal-open");
    const image = root.querySelector("#modal-image");
    if (image) image.src = "";
  };

  root.querySelectorAll("[data-close-modal]").forEach((el) => {
    el.addEventListener("click", close);
  });
  root.addEventListener("click", (event) => {
    if (event.target === root) close();
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !root.classList.contains("hidden")) close();
  });

  return close;
}

export function setModalNotes(notesEl, labelEl, note) {
  const text = (note || "").trim();
  if (labelEl) labelEl.hidden = !text;
  if (!notesEl) return;
  notesEl.textContent = text;
  notesEl.hidden = !text;
}
