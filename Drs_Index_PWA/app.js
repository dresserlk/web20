const API_URL =
  "https://script.google.com/macros/s/AKfycbxxxxxxxxxxxxxxxxxxxxxxxxxxxx/exec";

async function loadData() {
  const res = await fetch(`${API_URL}?action=getStoreData`);
  const data = await res.json();

  if (data.error) {
    alert(data.error);
    return;
  }

  const container = document.getElementById("items");
  container.innerHTML = "";

  data.rows.forEach((row, i) => {
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <strong>${row[0]}</strong> <br>
      <img src="${row[data.headers.indexOf('Image')]}" width="120"><br><br>
      <button onclick="deleteRow('${data.sheetId}', ${i})">Delete</button>
    `;
    container.appendChild(div);
  });
}

async function deleteRow(sheetId, rowIndex) {
  if (!confirm("Delete this item?")) return;

  await fetch(
    `${API_URL}?action=deleteRow&sheetId=${sheetId}&rowIndex=${rowIndex}`
  );

  loadData();
}
