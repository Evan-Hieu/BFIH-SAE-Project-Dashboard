let allData = [];

let statusChart = null;
let projectChart = null;


/* =========================================
   START
========================================= */

document.addEventListener("DOMContentLoaded", () => {

  loadData();

  [
    "projectFilter",
    "buildFilter",
    "picFilter",
    "stageFilter"
  ].forEach(id => {

    document
      .getElementById(id)
      .addEventListener(
        "change",
        applyFilters
      );

  });


  document
    .getElementById("searchInput")
    .addEventListener(
      "input",
      applyFilters
    );


  document
    .getElementById("resetButton")
    .addEventListener(
      "click",
      resetFilters
    );

});


/* =========================================
   LOAD DATA
========================================= */

async function loadData() {

  try {

    const response =
      await fetch(
        "sae_data.json?v=" +
        Date.now()
      );


    if (!response.ok) {
      throw new Error(
        "Cannot load sae_data.json"
      );
    }


    const raw =
      await response.json();


    allData =
      raw.map(item =>
        enrichData(item)
      );


    populateFilters();

    renderDashboard(allData);


    document
      .getElementById(
        "lastUpdated"
      )
      .textContent =
      new Date()
        .toLocaleString();

  }

  catch (error) {

    console.error(error);

    document
      .getElementById(
        "pendingBody"
      )
      .innerHTML = `

        <tr>
          <td colspan="7"
              style="
                text-align:center;
                color:red;
                padding:30px;
              ">
            Unable to load SAE data
          </td>
        </tr>

      `;

  }

}


/* =========================================
   ENRICH DATA
========================================= */

function enrichData(item) {

  const cpGap =
    calculateCPGap(
      item["NBD"]
    );


  const stageInfo =
    getPendingStage(item);


  return {

    ...item,

    cpGap,

    pendingStage:
      stageInfo.stage,

    nextAction:
      stageInfo.action,

    priority:
      getPriority(
        cpGap,
        item["Dispatched date"]
      )

  };

}


/* =========================================
   CP GAP

   TODAY - CM NBD
========================================= */

function calculateCPGap(nbd) {

  if (
    !hasValue(nbd) ||
    String(nbd)
      .trim()
      .toUpperCase() === "TBC"
  ) {
    return null;
  }


  const date =
    parseDate(nbd);


  if (!date) {
    return null;
  }


  const today =
    new Date();


  today.setHours(
    0, 0, 0, 0
  );


  return Math.floor(

    (
      today.getTime() -
      date.getTime()
    )

    /

    (
      1000 *
      60 *
      60 *
      24
    )

  );

}


/* =========================================
   PRIORITY
========================================= */

function getPriority(
  cpGap,
  dispatchedDate
) {

  if (
    hasValue(
      dispatchedDate
    )
  ) {

    return {
      label:
        "● Dispatched",

      className:
        "badge-green"
    };

  }


  if (cpGap === null) {

    return {
      label:
        "● No NBD",

      className:
        "badge-gray"
    };

  }


  if (cpGap > 0) {

    return {
      label:
        "● Overdue",

      className:
        "badge-red"
    };

  }


  if (cpGap >= -3) {

    return {
      label:
        "● Due ≤3d",

      className:
        "badge-orange"
    };

  }


  if (cpGap >= -7) {

    return {
      label:
        "● Due ≤7d",

      className:
        "badge-yellow"
    };

  }


  return {
    label:
      "● Upcoming",

    className:
      "badge-green"
  };

}


/* =========================================
   PENDING STAGE
========================================= */

function getPendingStage(item) {

  const type =
    String(
      item["Type"] || ""
    )
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


  if (
    !hasValue(
      item["FIH PO Number"]
    )
  ) {

    return {

      stage:
        "FIH PO Pending",

      action:
        "Follow up FIH PO number"

    };

  }


  if (
    hasValue(
      item["Target date"]
    ) &&
    !hasValue(
      item["Released"]
    )
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
      item[
        "Official PO Target date"
      ]
    ) &&
    !hasValue(
      item[
        "Official PO Released"
      ]
    )
  ) {

    return {

      stage:
        "Official PO Pending",

      action:
        "Follow up Official PO release"

    };

  }


  if (
    !hasValue(
      item["Vendor ETD"]
    )
  ) {

    return {

      stage:
        "Vendor ETD Pending",

      action:
        "Confirm Vendor ETD"

    };

  }


  if (
    !hasValue(
      item["AWB Bill"]
    )
  ) {

    return {

      stage:
        "AWB Pending",

      action:
        "Get AWB / shipment confirmation"

    };

  }


  if (
    !hasValue(
      item["BFIH Actual ETA"]
    )
  ) {

    return {

      stage:
        "BFIH Arrival Pending",

      action:
        "Track shipment / confirm BFIH arrival"

    };

  }


  if (
    !hasValue(
      item["CM PO Number"]
    )
  ) {

    return {

      stage:
        "CM PO Pending",

      action:
        "Follow up CM PO"

    };

  }


  if (
    !hasValue(
      item["CM Released date"]
    )
  ) {

    return {

      stage:
        "CM Release Pending",

      action:
        "Follow up CM release"

    };

  }


  if (
    !hasValue(
      item["VMI ETA plan"]
    )
  ) {

    return {

      stage:
        "VMI ETA Plan Pending",

      action:
        "Confirm VMI ETA plan"

    };

  }


  if (
    !hasValue(
      item["VMI ETA"]
    )
  ) {

    return {

      stage:
        "VMI Arrival Pending",

      action:
        "Confirm VMI ETA / arrival"

    };

  }


  if (
    !hasValue(
      item["Dispatched date"]
    )
  ) {

    return {

      stage:
        "Dispatch Pending",

      action:
        "Push dispatch to customer"

    };

  }


  return {

    stage:
      "Completed",

    action:
      "-"

  };

}


/* =========================================
   FILTER OPTIONS
========================================= */

function populateFilters() {

  populateSelect(
    "projectFilter",
    allData.map(
      item =>
        item["Project"]
    )
  );


  populateSelect(
    "buildFilter",
    allData.map(
      item =>
        item["Build"]
    )
  );


  populateSelect(
    "picFilter",
    allData.map(
      item =>
        item["PIC"]
    )
  );


  populateSelect(
    "stageFilter",
    allData.map(
      item =>
        item.pendingStage
    )
  );

}


function populateSelect(
  elementId,
  values
) {

  const select =
    document
      .getElementById(
        elementId
      );


  const unique =
    [
      ...new Set(
        values
          .filter(hasValue)
          .map(
            value =>
              String(value)
                .trim()
          )
      )
    ]
    .sort();


  unique.forEach(value => {

    const option =
      document
        .createElement(
          "option"
        );


    option.value =
      value;


    option.textContent =
      value;


    select.appendChild(
      option
    );

  });

}


/* =========================================
   FILTER
========================================= */

function applyFilters() {

  const project =
    document
      .getElementById(
        "projectFilter"
      )
      .value;


  const build =
    document
      .getElementById(
        "buildFilter"
      )
      .value;


  const pic =
    document
      .getElementById(
        "picFilter"
      )
      .value;


  const stage =
    document
      .getElementById(
        "stageFilter"
      )
      .value;


  const search =
    document
      .getElementById(
        "searchInput"
      )
      .value
      .trim()
      .toLowerCase();


  const filtered =
    allData.filter(item => {

      if (
        project &&
        item["Project"] !==
        project
      ) {
        return false;
      }


      if (
        build &&
        item["Build"] !==
        build
      ) {
        return false;
      }


      if (
        pic &&
        item["PIC"] !==
        pic
      ) {
        return false;
      }


      if (
        stage &&
        item.pendingStage !==
        stage
      ) {
        return false;
      }


      if (search) {

        const text = [

          item["Project"],

          item["Build"],

          item[
            "Machine/Equipment name"
          ],

          item["Spec"],

          item["PIC"],

          item["Vendor"],

          item[
            "Overall status"
          ],

          item["Remark"]

        ]
        .join(" ")
        .toLowerCase();


        if (
          !text.includes(
            search
          )
        ) {
          return false;
        }

      }


      return true;

    });


  renderDashboard(
    filtered
  );

}


/* =========================================
   RESET
========================================= */

function resetFilters() {

  [
    "projectFilter",
    "buildFilter",
    "picFilter",
    "stageFilter"
  ]
  .forEach(id => {

    document
      .getElementById(id)
      .value = "";

  });


  document
    .getElementById(
      "searchInput"
    )
    .value = "";


  renderDashboard(
    allData
  );

}


/* =========================================
   DASHBOARD
========================================= */

function renderDashboard(data) {

  updateKPI(data);

  renderPending(data);

  renderStatusChart(data);

  renderProjectChart(data);

}


/* =========================================
   KPI
========================================= */

function updateKPI(data) {

  const total =
    data.length;


  const overdue =
    data.filter(item =>

      !hasValue(
        item["Dispatched date"]
      )

      &&

      item.cpGap !== null

      &&

      item.cpGap > 0

    ).length;


  const due3 =
    data.filter(item =>

      !hasValue(
        item["Dispatched date"]
      )

      &&

      item.cpGap !== null

      &&

      item.cpGap <= 0

      &&

      item.cpGap >= -3

    ).length;


  const due7 =
    data.filter(item =>

      !hasValue(
        item["Dispatched date"]
      )

      &&

      item.cpGap <= -4

      &&

      item.cpGap >= -7

    ).length;


  const dispatched =
    data.filter(item =>

      hasValue(
        item["Dispatched date"]
      )

    ).length;


  setText(
    "totalCount",
    total
  );

  setText(
    "overdueCount",
    overdue
  );

  setText(
    "due3Count",
    due3
  );

  setText(
    "due7Count",
    due7
  );

  setText(
    "dispatchedCount",
    dispatched
  );


  setText(
    "totalPercent",
    total
      ? "100% of total"
      : "0% of total"
  );


  setText(
    "overduePercent",
    percentage(
      overdue,
      total
    )
  );


  setText(
    "due3Percent",
    percentage(
      due3,
      total
    )
  );


  setText(
    "due7Percent",
    percentage(
      due7,
      total
    )
  );


  setText(
    "dispatchedPercent",
    percentage(
      dispatched,
      total
    )
  );

}


/* =========================================
   PENDING DETAILS
========================================= */

function renderPending(data) {

  const tbody =
    document
      .getElementById(
        "pendingBody"
      );


  tbody.innerHTML = "";


  const pending =
    data

      .filter(item =>

        !hasValue(
          item[
            "Dispatched date"
          ]
        )

      )

      .sort(
        (a, b) =>
          getSortScore(a) -
          getSortScore(b)
      );


  setText(
    "pendingCount",
    `${pending.length} items`
  );


  if (
    pending.length === 0
  ) {

    tbody.innerHTML = `

      <tr>
        <td colspan="7"
            style="
              text-align:center;
              padding:30px;
              color:#64748b;
            ">
          No pending items
        </td>
      </tr>

    `;

    return;

  }


  pending.forEach(item => {

    const tr =
      document
        .createElement(
          "tr"
        );


    tr.innerHTML = `

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

        <br>

        <strong>
          ${escapeHTML(
            item["Build"]
          )}
        </strong>

      </td>


      <td>
        ${escapeHTML(
          item[
            "Machine/Equipment name"
          ]
        )}
      </td>


      <td>
        ${formatDisplayDate(
          item["NBD"]
        )}
      </td>


      <td class="
        ${getCPClass(
          item.cpGap
        )}
      ">
        ${formatCPGap(
          item.cpGap
        )}
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

    `;


    tbody.appendChild(
      tr
    );

  });

}


/* =========================================
   DONUT
========================================= */

function renderStatusChart(data) {

  const counts = {};


  data.forEach(item => {

    const status =
      hasValue(
        item[
          "Overall status"
        ]
      )

      ? String(
          item[
            "Overall status"
          ]
        )

      : "No Status";


    counts[status] =
      (
        counts[status] || 0
      ) + 1;

  });


  const labels =
    Object.keys(counts);


  const values =
    Object.values(counts);


  if (statusChart) {
    statusChart.destroy();
  }


  statusChart =
    new Chart(

      document
        .getElementById(
          "statusChart"
        ),

      {

        type:
          "doughnut",

        data: {

          labels,

          datasets: [{

            data:
              values,

            backgroundColor: [
              "#f58213",
              "#2fa34a",
              "#1261d6",
              "#ef2b1f",
              "#efb20b",
              "#94a3b8"
            ],

            borderWidth:
              1

          }]

        },


        options: {

          responsive:
            true,

          maintainAspectRatio:
            false,

          cutout:
            "58%",

          plugins: {

            legend: {

              position:
                "right",

              labels: {

                boxWidth:
                  10,

                font: {
                  size: 11
                }

              }

            }

          }

        }

      }

    );

}


/* =========================================
   BAR CHART
========================================= */

function renderProjectChart(
  data
) {

  const groups = {};


  data.forEach(item => {

    const project =
      item["Project"] || "-";


    const build =
      item["Build"] || "-";


    const key =
      `${project} ${build}`;


    if (!groups[key]) {

      groups[key] = {
        total: 0,
        overdue: 0
      };

    }


    groups[key].total++;


    if (
      !hasValue(
        item["Dispatched date"]
      )

      &&

      item.cpGap !== null

      &&

      item.cpGap > 0
    ) {

      groups[key]
        .overdue++;

    }

  });


  const labels =
    Object.keys(groups);


  const totalValues =
    labels.map(
      label =>
        groups[label].total
    );


  const overdueValues =
    labels.map(
      label =>
        groups[label].overdue
    );


  if (projectChart) {
    projectChart.destroy();
  }


  projectChart =
    new Chart(

      document
        .getElementById(
          "projectChart"
        ),

      {

        type:
          "bar",

        data: {

          labels,

          datasets: [

            {
              label:
                "Total Items",

              data:
                totalValues,

              backgroundColor:
                "#1261d6"
            },

            {
              label:
                "Overdue",

              data:
                overdueValues,

              backgroundColor:
                "#ef2b1f"
            }

          ]

        },


        options: {

          responsive:
            true,

          maintainAspectRatio:
            false,

          indexAxis:
            "y",

          scales: {

            x: {
              beginAtZero:
                true,

              ticks: {
                precision: 0
              }
            }

          },

          plugins: {

            legend: {

              position:
                "top",

              labels: {

                boxWidth:
                  10,

                font: {
                  size: 10
                }

              }

            }

          }

        }

      }

    );

}


/* =========================================
   SORT
========================================= */

function getSortScore(item) {

  if (
    hasValue(
      item[
        "Dispatched date"
      ]
    )
  ) {
    return 999999;
  }


  if (
    item.cpGap === null
  ) {
    return 500000;
  }


  return -item.cpGap;

}


/* =========================================
   HELPERS
========================================= */

function hasValue(value) {

  if (
    value === null ||
    value === undefined
  ) {
    return false;
  }


  const text =
    String(value)
      .trim();


  return !(
    text === "" ||
    text === "-" ||
    text.toLowerCase()
      === "null"
  );

}


function percentage(
  value,
  total
) {

  if (!total) {
    return "0% of total";
  }


  return (
    (
      value /
      total *
      100
    )
    .toFixed(1)
    .replace(
      ".0",
      ""
    )

    + "% of total"
  );

}


function setText(
  id,
  value
) {

  document
    .getElementById(id)
    .textContent =
    value;

}


/* =========================================
   DATE
========================================= */

function parseDate(value) {

  if (!value) {
    return null;
  }


  const text =
    String(value)
      .trim();


  if (
    text === "" ||
    text.toUpperCase()
      === "TBC"
  ) {
    return null;
  }


  // YYYY-MM-DD

  if (
    /^\d{4}-\d{2}-\d{2}$/
      .test(text)
  ) {

    const [
      year,
      month,
      day
    ] =
      text
        .split("-")
        .map(Number);


    return new Date(
      year,
      month - 1,
      day
    );

  }


  // M/D/YYYY

  if (
    /^\d{1,2}\/\d{1,2}\/\d{4}$/
      .test(text)
  ) {

    const [
      month,
      day,
      year
    ] =
      text
        .split("/")
        .map(Number);


    return new Date(
      year,
      month - 1,
      day
    );

  }


  return null;

}


function formatDisplayDate(
  value
) {

  if (!hasValue(value)) {
    return "";
  }


  if (
    String(value)
      .toUpperCase()
      === "TBC"
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
    )
    .padStart(
      2,
      "0"
    );


  const day =
    String(
      date.getDate()
    )
    .padStart(
      2,
      "0"
    );


  return `${month}/${day}`;

}


/* =========================================
   CP GAP FORMAT
========================================= */

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


/* =========================================
   HTML SAFETY
========================================= */

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
