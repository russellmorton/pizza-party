// Vercel Web Analytics. Only on the deployed site: the script isn't there on the local server.
if (location.protocol === "https:") {
  const s = document.createElement("script");
  s.src = "/_vercel/insights/script.js";
  document.head.appendChild(s);
}
