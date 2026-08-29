let allData = [];


/* ================================
   START
================================ */

document.addEventListener("DOMContentLoaded", () => {

  loadData();

  document
    .getElementById("projectFilter")
    .addEventListener("change", applyFilters);

  document
    .getElementById("buildFilter")
    .addEventListener("change", applyFilters);

  document
    .getElementById("picFilter")
    .addEventListener("change", applyFilters);

  document
    .getElementById("stageFilter")
    .addEventListener("change", applyFilters);

  document
    .getElementById("searchInput")
    .addEventListener("input", applyFilters);

  document
    .getElementById("resetButton")
    .addEventListener("click", resetFilters);

});


/* ================================
   LOAD JSON
================================ */

async function loadData() {

  try {

    const response = await fetch(
      "sae_data.json?time=" + new Date().getTime()
    );

    if (!response.ok) {
      throw new Error("Unable to load SAE data");
    }

    const data = await response.json();

    allData = data.map(item => enrichData(item));

    populateFilters();

    renderDashboard(allData);

    document.getElementById("lastUpdated").textContent =
      new Date().toLocaleString();

  }

  catch (error) {

    console.error(error);

    document.getElementById("dataBody").innerHTML = `
      <tr>
        <td colspan="15" style="text-align:center;color:red;">
          Unable to load SAE data
        </td>
      </tr>
    `;

  }

}


/* ================================
   CALCULATED DATA
================================ */

function enrichData(item) {

  const cpGap = calculateCPGap(item["NBD"]);

  const stageInfo = getPendingStage(item);

  return {

    ...item,

    cpGap: cpGap,

    priority: getPriority(
      cpGap,
      item["Dispatched date"]
    ),

    pendingStage: stageInfo.stage,

    nextAction: stageInfo.action

  };

}


/* ================================
   CP GAP

   CP Gap = TODAY - CM NBD
================================ */

function calculateCPGap(nbd) {

  if (
    !nbd ||
    String(nbd).trim() === "" ||
    String(nbd).toUpperCase() === "TBC"
  ) {
    return null;
  }

  const nbdDate = parseDate(nbd);

  if (!nbdDate) {
    return null;
  }

  const today = new Date();

  today.setHours(0, 0, 0, 0);

  const diff =
    today.getTime() -
    nbdDate.getTime();

  return Math.floor(
    diff / (1000 * 60 * 60 * 24)
  );

}


/* ================================
   PRIORITY
================================ */

function getPriority(cpGap, dispatchedDate) {

  if (dispatchedDate) {

    return {
      label: "✅ Dispatched",
      className: "badge-green"
    };

  }


  if (cpGap === null) {

    return {
      label: "⚪ No NBD",
      className: "badge-gray"
    };

  }


  if (cpGap > 0) {

    return {
      label: "🔴 Overdue",
      className: "badge-red"
    };

  }


  if (cpGap >= -3) {

    return {
      label: "🟠 Due ≤3d",
      className: "badge-orange"
    };

  }


  if (cpGap >= -7) {

    return {
      label: "🟡 Due ≤7d",
      className: "badge-yellow"
    };

  }


  return {
    label: "🟢 Upcoming",
    className: "badge-green"
  };

}


/* ================================
   CURRENT PENDING STAGE
================================ */

function getPendingStage(item) {

  const type =
    String(item["Type"] || "")
      .trim()
      .toLowerCase();


  if (type === "inhouse") {

    return {
      stage:
        "Project / Inhouse Follow-up",

      action:
        "Check execution progress vs NBD"
    };

  }


  if (!hasValue(item["FIH PO Number"])) {

    return {
      stage: "FIH PO Pending",

      action:
        "Follow up FIH PO number"
    };

  }


  if (
    hasValue(item["Target date"]) &&
    !hasValue(item["Released"])
  ) {

    return {
      stage:
        "FIH PO Release Pending",

      action:
        "Follow up FIH PO release"
    };

  }


  if (
    hasValue(
      item["Official PO Target date"]
    ) &&
    !hasValue(
      item["Official PO Released"]
    )
  ) {

    return {
      stage:
        "Official PO Pending",

      action:
        "Follow up Official PO release"
    };

  }


  if (!hasValue(item["Vendor ETD"])) {

    return {
      stage:
        "Vendor ETD Pending",

      action:
        "Confirm Vendor ETD"
    };

  }


  if (!hasValue(item["AWB Bill"])) {

    return {
      stage:
        "AWB Pending",

      action:
        "Get AWB / shipment confirmation"
    };

  }


  if (!hasValue(item["BFIH Actual ETA"])) {

    return {
      stage:
        "BFIH Arrival Pending",

      action:
        "Track shipment / confirm BFIH arrival"
    };

  }


  if (!hasValue(item["CM PO Number"])) {

    return {
      stage:
        "CM PO Pending",

      action:
        "Follow up CM PO"
    };

  }


  if (!hasValue(item["CM Released date"])) {

    return {
      stage:
        "CM Release Pending",

      action:
        "Follow up CM release"
    };

  }


  if (!hasValue(item["VMI ETA plan"])) {

    return {
      stage:
        "VMI ETA Plan Pending",

      action:
        "Confirm VMI ETA plan"
    };

  }


  if (!hasValue(item["VMI ETA"])) {

    return {
      stage:
        "VMI Arrival Pending",

      action:
        "Confirm VMI ETA / arrival"
    };

  }


  if (!hasValue(item["Dispatched date"])) {

    return {
      stage:
        "Dispatch Pending",

      action:
        "Push dispatch to customer"
    };

  }


  return {
    stage: "Completed",
    action: "-"
  };

}


/* ================================
   VALUE CHECK
================================ */

function hasValue(value) {

  if (
    value === null ||
    value === undefined
  ) {
    return false;
  }

  const text =
    String(value).trim();

  if (
    text === "" ||
    text === "-" ||
    text.toLowerCase() === "null"
  ) {
    return false;
  }

  return true;

}


/* ================================
   FILTER OPTIONS
================================ */

function populateFilters() {

  populateSelect(
    "projectFilter",
    allData.map(x => x["Project"])
  );

  populateSelect(
    "buildFilter",
    allData.map(x => x["Build"])
  );

  populateSelect(
    "picFilter",
    allData.map(x => x["PIC"])
  );

  populateSelect(
    "stageFilter",
    allData.map(x => x.pendingStage)
  );

}


function populateSelect(elementId, values) {

  const select =
    document.getElementById(elementId);

  const uniqueValues =
    [...new Set(
      values
        .filter(Boolean)
        .map(v => String(v).trim())
    )]
    .sort();


  uniqueValues.forEach(value => {

    const option =
      document.createElement("option");

    option.value = value;

    option.textContent = value;

    select.appendChild(option);

  });

}


/* ================================
   FILTERING
================================ */

function applyFilters() {

  const project =
    document.getElementById(
      "projectFilter"
    ).value;

  const build =
    document.getElementById(
      "buildFilter"
    ).value;

  const pic =
    document.getElementById(
      "picFilter"
    ).value;

  const stage =
    document.getElementById(
      "stageFilter"
    ).value;

  const search =
    document.getElementById(
      "searchInput"
    ).value
    .toLowerCase()
    .trim();


  const filtered =
    allData.filter(item => {

      if (
        project &&
        item["Project"] !== project
      ) {
        return false;
      }


      if (
        build &&
        item["Build"] !== build
      ) {
        return false;
      }


      if (
        pic &&
        item["PIC"] !== pic
      ) {
        return false;
      }


      if (
        stage &&
        item.pendingStage !== stage
      ) {
        return false;
      }


      if (search) {

        const searchText = [

          item["Project"],
          item["Build"],
          item["Machine/Equipment name"],
          item["Spec"],
          item["PIC"],
          item["Vendor"],
          item["Overall status"],
          item["Remark"]

        ]
        .join(" ")
        .toLowerCase();


        if (
          !searchText.includes(search)
        ) {
          return false;
        }

      }


      return true;

    });


  renderDashboard(filtered);

}


/* ================================
   RESET
================================ */

function resetFilters() {

  document.getElementById(
    "projectFilter"
  ).value = "";

  document.getElementById(
    "buildFilter"
  ).value = "";

  document.getElementById(
    "picFilter"
  ).value = "";

  document.getElementById(
    "stageFilter"
  ).value = "";

  document.getElementById(
    "searchInput"
  ).value = "";

  renderDashboard(allData);

}


/* ================================
   RENDER
================================ */

function renderDashboard(data) {

  updateKPI(data);

  renderTable(data);

  document.getElementById(
    "resultCount"
  ).textContent =
    `${data.length} items`;

}


/* ================================
   KPI
================================ */

function updateKPI(data) {

  const total =
    data.length;


  const overdue =
    data.filter(item =>
      !item["Dispatched date"] &&
      item.cpGap !== null &&
      item.cpGap > 0
    ).length;


  const due =
    data.filter(item =>
      !item["Dispatched date"] &&
      item.cpGap !== null &&
      item.cpGap <= 0 &&
      item.cpGap >= -7
    ).length;


  const dispatched =
    data.filter(item =>
      hasValue(
        item["Dispatched date"]
      )
    ).length;


  document.getElementById(
    "totalCount"
  ).textContent = total;

  document.getElementById(
    "overdueCount"
  ).textContent = overdue;

  document.getElementById(
    "dueCount"
  ).textContent = due;

  document.getElementById(
    "dispatchedCount"
  ).textContent = dispatched;

}


/* ================================
   TABLE
================================ */

function renderTable(data) {

  const tbody =
    document.getElementById(
      "dataBody"
    );

  tbody.innerHTML = "";


  if (data.length === 0) {

    tbody.innerHTML = `
      <tr>
        <td colspan="15"
            style="text-align:center;
                   padding:30px;">
          No matching data
        </td>
      </tr>
    `;

    return;

  }


  const sorted =
    [...data].sort(
      (a, b) =>
        getSortScore(a) -
        getSortScore(b)
    );


  sorted.forEach(item => {

    const row =
      document.createElement("tr");


    const cpGapText =
      formatCPGap(item.cpGap);


    const cpClass =
      getCPClass(item.cpGap);


    row.innerHTML = `

      <td>
        <span class="
          badge
          ${item.priority.className}
        ">
          ${escapeHTML(
            item.priority.label
          )}
        </span>
      </td>

      <td>
        ${escapeHTML(
          item["Project"]
        )}
      </td>

      <td>
        ${escapeHTML(
          item["Build"]
        )}
      </td>

      <td>
        ${escapeHTML(
          item["Machine/Equipment name"]
        )}
      </td>

      <td>
        ${escapeHTML(
          item["Spec"]
        )}
      </td>

      <td>
        ${escapeHTML(
          item["KO QTY"]
        )}
      </td>

      <td>
        ${escapeHTML(
          item["PIC"]
        )}
      </td>

      <td>
        ${escapeHTML(
          item["Vendor"]
        )}
      </td>

      <td>
        ${formatDisplayDate(
          item["NBD"]
        )}
      </td>

      <td>
        ${formatDisplayDate(
          item["BFIH site arrive"]
        )}
      </td>

      <td class="${cpClass}">
        ${cpGapText}
      </td>

      <td class="stage">
        ${escapeHTML(
          item.pendingStage
        )}
      </td>

      <td>
        ${escapeHTML(
          item.nextAction
        )}
      </td>

      <td>
        ${escapeHTML(
          item["Overall status"]
        )}
      </td>

      <td>
        ${escapeHTML(
          item["Remark"]
        )}
      </td>

    `;


    tbody.appendChild(row);

  });

}


/* ================================
   URGENCY SORT

   overdue first
   then due soon
================================ */

function getSortScore(item) {

  if (
    hasValue(
      item["Dispatched date"]
    )
  ) {
    return 999999;
  }


  if (item.cpGap === null) {
    return 500000;
  }


  /*
     CP Gap:
     +30 = badly overdue
     +1  = overdue
     -1  = tomorrow
     -30 = far away

     We want highest CP Gap first.
  */

  return -item.cpGap;

}


/* ================================
   CP FORMAT
================================ */

function formatCPGap(value) {

  if (value === null) {
    return "";
  }

  if (value > 0) {
    return `+${value}`;
  }

  return String(value);

}


function getCPClass(value) {

  if (value === null) {
    return "";
  }

  if (value > 0) {
    return "cp-overdue";
  }

  if (value >= -7) {
    return "cp-warning";
  }

  return "cp-safe";

}


/* ================================
   DATE
================================ */

function parseDate(value) {

  if (!value) {
    return null;
  }

  const text =
    String(value).trim();


  if (
    text === "" ||
    text.toUpperCase() === "TBC"
  ) {
    return null;
  }


  // YYYY-MM-DD
  if (
    /^\d{4}-\d{2}-\d{2}$/
      .test(text)
  ) {

    const parts =
      text.split("-");

    return new Date(
      Number(parts[0]),
      Number(parts[1]) - 1,
      Number(parts[2])
    );

  }


  // M/D/YYYY
  if (
    /^\d{1,2}\/\d{1,2}\/\d{4}$/
      .test(text)
  ) {

    const parts =
      text.split("/");

    return new Date(
      Number(parts[2]),
      Number(parts[0]) - 1,
      Number(parts[1])
    );

  }


  return null;

}


function formatDisplayDate(value) {

  if (!value) {
    return "";
  }


  if (
    String(value)
      .toUpperCase() === "TBC"
  ) {
    return "TBC";
  }


  const date =
    parseDate(value);


  if (!date) {
    return escapeHTML(value);
  }


  const month =
    String(
      date.getMonth() + 1
    ).padStart(2, "0");


  const day =
    String(
      date.getDate()
    ).padStart(2, "0");


  return `${month}/${day}`;

}


/* ================================
   SAFE HTML
================================ */

function escapeHTML(value) {

  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }


  return String(value)

    .replaceAll(
      "&",
      "&amp;"
    )

    .replaceAll(
      "<",
      "&lt;"
    )

    .replaceAll(
      ">",
      "&gt;"
    )

    .replaceAll(
      '"',
      "&quot;"
    )

    .replaceAll(
      "'",
      "&#039;"
    );

}
