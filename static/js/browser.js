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
    traces: [],
  },
};



// Plot functions
function initPlot(plot) {
  Plotly.newPlot(plot.obj, [], {
    title: "Recorded Waveform",
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

function addTrace(plot, dataset, id, data) {
  Plotly.addTraces(plot.obj, [
    {
      x: data.time,
      y: data.amplitude,
      name: dataset + ": " + id,
     }
  ]);

  plot.traces.push([dataset, id])
}

function findTrace(plot, dataset, id) {
  return plot.traces.findIndex((item) => (item[0] == dataset && item[1] == id))
}

function isTrace(plot, dataset, id) {
  return findTrace(plot, dataset, id) >= 0;
}

function removeTrace(plot, dataset, id) {
  var idx = findTrace(plot, dataset, id);

  Plotly.deleteTraces(plot.obj, idx)
  plot.traces.splice(idx, 1)
}

function clearPlot(plot) {
  initPlot(plot);
  plot.traces = []
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

function loadTrace(dataset, id) {
  $.getJSON(BASE_URL + "dataset/" + dataset + '/' + id, function(data){
    if(!$.isEmptyObject(data)) {
      addTrace(TCTBrowser.plot, dataset, id, data);
    }
  });
}

function selectScan() {
  var id = $($(this).children('td')[0]).html();
  var dataset =  TCTBrowser.selected_dataset;

  if(isTrace(TCTBrowser.plot, dataset, id)) {
    removeTrace(TCTBrowser.plot, dataset, id);
    $(this).removeClass('selected');
  } else {
    loadTrace(dataset, id);
    $(this).addClass('selected');
  }
}

function loadDatasets() {
    $.getJSON(BASE_URL + "dataset", function(data) {
      TCTBrowser.dataset_table.data = data;
      fillTable(TCTBrowser.dataset_table, {});

      resetFilter(TCTBrowser.dataset_table)
    });
}

function parseHash() {
  if(window.location.hash) {
    var hash = decodeURI(window.location.hash.substring(1));
    var data = null;

    console.log(hash);

    try {
      data = JSON.parse(hash);
      console.log(data);
    }
    catch(err) {
      return;
    }

    for(dataset in data) {
      for(ii in data[dataset]) {
        loadTrace(dataset, data[dataset][ii]);
      }
    }
  }
}

function createShareLink() {
  var base = window.location.href.split("#")[0];
  var selection = {}
  for(tt in TCTBrowser.plot.traces) {
    var entry = TCTBrowser.plot.traces[tt];
    var dataset = entry[0];
    var id = entry[1];

    if(!(dataset in selection)) {
      selection[dataset] = [];
    }

    selection[dataset].push(id);
  }

  return base + '#' + encodeURI(JSON.stringify(selection));
}

function init() {
  initPlot(TCTBrowser.plot);

  createTable(TCTBrowser.dataset_table);
  loadDatasets();
  parseHash();
}


function copyToClipboard(textToCopy) {
    if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(textToCopy);
    } else {
        // text area method
        var textArea = document.createElement("textarea");
        textArea.value = textToCopy;
        textArea.style.position = "absolute";
        textArea.style.opacity = 0;
        document.body.appendChild(textArea);
        textArea.select();
        return new Promise((res, rej) => {
            // here the magic happens
            document.execCommand('copy') ? res() : rej();
            textArea.remove();
        });
    }
}


$(document).ready(function() {
  TCTBrowser.dataset_table.obj = $('#dataset_list > table');
  TCTBrowser.dataset_table.onclick = selectDataset;
  TCTBrowser.dataset_table.isselected = function(id) {
      return id == TCTBrowser.selected_dataset
  };

  TCTBrowser.scan_table.obj = $('#entry_list > table');
  TCTBrowser.scan_table.onclick = selectScan;
  TCTBrowser.scan_table.isselected = function(id) {
    return isTrace(TCTBrowser.plot, TCTBrowser.selected_dataset, id);
  };

  TCTBrowser.plot.obj = document.getElementById('tct_plot');

  $('#btn_refresh').click(function(){
    $.get(BASE_URL + 'reload', init);
  });
  $('#btn_clear').click(function(){
    clearPlot(TCTBrowser.plot);
    TCTBrowser.scan_table.obj.find('tbody tr').removeClass('selected');
  });
  $('#btn_share').click(function(){
    copyToClipboard(createShareLink());
  });

  init();
});
