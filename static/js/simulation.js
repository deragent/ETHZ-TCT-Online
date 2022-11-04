var TCTBrowser = {
  selected_dataset: null,
  dataset_table: {
    obj: null,
    columns: ['_prefix', 'laser', 'wafer', 'sample', 'side', 'operator'],
    data: {},
    onclick: function(){ console.log('test click'); },
    isselected: function(id){ return false; },
  },

  scan_table: {
    obj: null,
    data: {},
    columns: [],
    onclick: function(){ console.log('test click'); },
    isselected: function(id){ return false; },
  },
  plot: {
    obj: null,
    trace: null
  },
};



// Plot functions
function initPlot(plot) {
  Plotly.newPlot(plot.obj, [], {
    title: "Recorded Waveform vs. Simulation",
    xaxis: { title: "Time [ns]" },
    yaxis: { title: "Amplitude [mV]"},
    showlegend: true,
    legend: {
      x: 1,
      xanchor: 'right',
      y: 1
    },
  });
}

function addDataTrace(plot, dataset, id, data) {
  var label = dataset + "[" + id + "]:";
  var scan = TCTBrowser.scan_table.data[id]
  for(key in scan) {
    if(key == '_prefix') continue;

    label += ' / ' + key + '=' + scan[key];
  }

  Plotly.addTraces(plot.obj, [
    {
      x: data.time,
      y: data.amplitude,
      name: label,
     }
  ]);
}

function addSimulationTrace(plot, data) {
  // TODO: Style
  // TODO: Maybe better labels

  Plotly.addTraces(plot.obj, [
    {
      x: data.time,
      y: data.simulation,
      name: 'Simulation',
    },
    {
      x: data.time,
      y: data.difference,
      name: 'Difference',
    }
  ]);
}

function clearPlot(plot) {
  initPlot(plot);
}


// Event handling functions
function selectDataset() {
  $(this).addClass('selected').siblings().removeClass('selected');

  var id = $($(this).children('td')[0]).html();
  TCTBrowser.selected_dataset = id;

  $.getJSON(BASE_URL + "dataset/"+id, function(data){
    TCTBrowser.scan_table.columns = data.changed_columns;
    TCTBrowser.scan_table.data = data.changed_data;
    TCTBrowser.scan_table.selected = null;

    createTable(TCTBrowser.scan_table);
    fillTable(TCTBrowser.scan_table, {});
  });
}

function runSimulation(dataset, id, param) {
  // TODO handle parameters
  $.getJSON(BASE_URL + "simulation/compare/" + dataset + '/' + id, function(data){
    if(!$.isEmptyObject(data)) {
      addDataTrace(TCTBrowser.plot, dataset, id, data);
      addSimulationTrace(TCTBrowser.plot, data);
    }
  });
}

function selectScan() {
  var id = $($(this).children('td')[0]).html();
  var dataset =  TCTBrowser.selected_dataset;

  clearPlot(TCTBrowser.plot)

  // TODO Update Initial Parameters

  // TODO Pass parameters
  runSimulation(dataset, id, {})

  // Select & Deselct the scans
  TCTBrowser.scan_table.obj.find('tbody tr').removeClass('selected');

  TCTBrowser.plot.trace = [dataset, id]
  $(this).addClass('selected');
}

function loadDatasets() {
    $.getJSON(BASE_URL + "dataset", function(data) {
      TCTBrowser.dataset_table.data = data;
      fillTable(TCTBrowser.dataset_table, {});

      resetFilter(TCTBrowser.dataset_table)
    });
}

// TODO Review / Adapt
// function parseHash() {
//   if(window.location.hash) {
//     var hash = decodeURI(window.location.hash.substring(1));
//     var data = null;
//
//     console.log(hash);
//
//     try {
//       data = JSON.parse(hash);
//       console.log(data);
//     }
//     catch(err) {
//       return;
//     }
//
//     for(dataset in data) {
//       for(ii in data[dataset]) {
//         loadTrace(dataset, data[dataset][ii]);
//       }
//     }
//   }
// }

// TODO Review / Adapt
// function createShareLink() {
//   var base = window.location.href.split("#")[0];
//   var selection = {}
//   for(tt in TCTBrowser.plot.traces) {
//     var entry = TCTBrowser.plot.traces[tt];
//     var dataset = entry[0];
//     var id = entry[1];
//
//     if(!(dataset in selection)) {
//       selection[dataset] = [];
//     }
//
//     selection[dataset].push(id);
//   }
//
//   return base + '#' + encodeURI(JSON.stringify(selection));
// }

function init() {
  initPlot(TCTBrowser.plot);

  createTable(TCTBrowser.dataset_table);
  loadDatasets();
  // parseHash();
}


// function copyToClipboard(textToCopy) {
//     if (navigator.clipboard && window.isSecureContext) {
//         return navigator.clipboard.writeText(textToCopy);
//     } else {
//         // text area method
//         var textArea = document.createElement("textarea");
//         textArea.value = textToCopy;
//         textArea.style.position = "absolute";
//         textArea.style.opacity = 0;
//         document.body.appendChild(textArea);
//         textArea.select();
//         return new Promise((res, rej) => {
//             // here the magic happens
//             document.execCommand('copy') ? res() : rej();
//             textArea.remove();
//         });
//     }
// }


$(document).ready(function() {
  TCTBrowser.dataset_table.obj = $('#dataset_list > table');
  TCTBrowser.dataset_table.onclick = selectDataset;
  TCTBrowser.dataset_table.isselected = function(id) {
      return id == TCTBrowser.selected_dataset
  };

  TCTBrowser.scan_table.obj = $('#entry_list > table');
  TCTBrowser.scan_table.onclick = selectScan;
  TCTBrowser.scan_table.isselected = function(id) {
    // TODO Does comparison of lists work like this?!?
    return TCTBrowser.plot.trace == [TCTBrowser.selected_dataset, id];
  };

  TCTBrowser.plot.obj = document.getElementById('tct_plot');

  $('#btn_refresh').click(function(){
    $.get(BASE_URL + 'reload', init);
  });
  $('#btn_clear').click(function(){
    clearPlot(TCTBrowser.plot);
    TCTBrowser.scan_table.obj.find('tbody tr').removeClass('selected');
  });
  // TODO Review
  // $('#btn_share').click(function(){
  //   copyToClipboard(createShareLink());
  // });

  init();
});
