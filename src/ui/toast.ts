// Thông báo nhẹ, tự ẩn (aria-live để trình đọc màn hình đọc được).

let box: HTMLElement | null = null;
let timer: number | undefined;

export function toast(message: string, ms = 5000) {
  if (!box) {
    box = document.createElement("div");
    box.className = "toast";
    box.setAttribute("role", "status");
    box.setAttribute("aria-live", "polite");
    document.body.appendChild(box);
    box.addEventListener("click", () => box!.classList.remove("show"));
  }
  box.textContent = message;
  box.classList.add("show");
  window.clearTimeout(timer);
  timer = window.setTimeout(() => box?.classList.remove("show"), ms);
}
