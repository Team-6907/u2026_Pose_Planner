export function createStatus(elements) {
  let statusTimeout = null;
  return function setStatus(msg, isError = false) {
    elements.status.textContent = msg;
    elements.status.className = "status " + (isError ? "error" : "success");
    clearTimeout(statusTimeout);
    statusTimeout = setTimeout(() => { elements.status.textContent = ""; }, 3000);
  };
}
