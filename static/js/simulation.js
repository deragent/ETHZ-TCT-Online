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
  sliders: {},
  select: {},
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
      y: data.data,
      name: 'Data (' + data.integral.data.toFixed(2) + ' Vns)',
     }
  ]);

  Plotly.relayout(plot.obj, {
    title: 'Recorded Waveform vs. Simulation [' + label + ']'
  });
}

function addSimulationTrace(plot, data) {
  // TODO: Style
  // TODO: Maybe better labels

  Plotly.addTraces(plot.obj, [
    {
      x: data.time,
      y: data.simulation,
      name: 'Simulation (' + data.integral.simulation.toFixed(2) + ' Vns)',
      line: {
        color: 'Black'
      }
    },
    {
      x: data.time,
      y: data.difference,
      name: 'Difference (' + data.integral.difference.toFixed(2) + ' Vns)',
      line: {
        color: 'Black',
        dash: 'dot',
      }
    }
  ]);
}

function clearPlot(plot) {
  initPlot(plot);
}


// Event handling functions
function clickDataset() {
  var id = $($(this).children('td')[0]).html();

  selectDataset(id);
}

function selectDataset(id, cb=null) {
  $('tr', TCTBrowser.dataset_table.obj).each(function(){
    if($('td', this).first().html() == id) {
      $(this).addClass('selected').siblings().removeClass('selected');
      return false;
    }
  });

  TCTBrowser.selected_dataset = id;

  $.getJSON(BASE_URL + "dataset/"+id, function(data){
    TCTBrowser.scan_table.columns = data.changed_columns;
    TCTBrowser.scan_table.data = data.changed_data;
    TCTBrowser.scan_table.selected = null;

    createTable(TCTBrowser.scan_table);
    fillTable(TCTBrowser.scan_table, {});

    if(cb != null) {
      cb();
    }
  });
}

function runSimulation(dataset, id, param) {
  $.getJSON(BASE_URL + "simulation/compare/" + dataset + '/' + id, param, function(data){
    if(!$.isEmptyObject(data)) {
      while(TCTBrowser.plot.obj.data.length>0)
      {
            Plotly.deleteTraces(TCTBrowser.plot.obj, [0]);
      }
      addDataTrace(TCTBrowser.plot, dataset, id, data);
      addSimulationTrace(TCTBrowser.plot, data);
    }
  });
}

function clickScan() {
  var id = $('td', this).first().html();

  selectScan(id);
}

function selectScan(id) {
  var dataset =  TCTBrowser.selected_dataset;

  clearPlot(TCTBrowser.plot)

  // TODO Update Initial Parameters

  // Select & Deselct the scans
  $('tr', TCTBrowser.scan_table.obj).each(function(){
    if($('td', this).first().html() == id) {
      $(this).addClass('selected').siblings().removeClass('selected');
      return false;
    }
  });

  TCTBrowser.plot.trace = [dataset, id]

  sliderCallback();
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

    var param = data['param'];
    for (var key in TCTBrowser.sliders) {
      if(key in param) {
        SliderSetValue(TCTBrowser.sliders[key], param[key]);
      }
    }
    for (var key in TCTBrowser.select) {
      if(key in param) {
        SelectSetValue(TCTBrowser.select[key], param[key]);
      }
    }

    if(data['trace'] != null && data['trace'].length == 2) {
      selectDataset(data['trace'][0], function() {
        selectScan(data['trace'][1]);
      });
    }
  }
}

function createShareLink() {
  var base = window.location.href.split("#")[0];
  var config = {}

  config['trace'] = TCTBrowser.plot.trace;

  var param = {};
  for (var key in TCTBrowser.sliders) {
    param[key] = SliderValue(TCTBrowser.sliders[key]);
  }
  for (var key in TCTBrowser.select) {
    param[key] = SelectValue(TCTBrowser.select[key]);
  }

  config['param'] = param;

  return base + '#' + encodeURI(JSON.stringify(config));
}

function sliderCallback() {
  var param = {};
  for (var key in TCTBrowser.sliders) {
    param[key] = SliderValue(TCTBrowser.sliders[key]);
  }
  for (var key in TCTBrowser.select) {
    param[key] = SelectValue(TCTBrowser.select[key]);
  }


  if(!TCTBrowser.plot.trace) {
    return;
  }

  runSimulation(TCTBrowser.plot.trace[0], TCTBrowser.plot.trace[1], param);
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


function initSliders() {
  // Data Parameters
  TCTBrowser.sliders['T0'] = SliderInit($('#param_t0'), [-10, 40], 18.0, 0.1, sliderCallback, 1e-9, 'T0', 'ns');
  TCTBrowser.sliders['offset'] = SliderInit($('#param_offset'), [-20, 20], -12.0, 0.1, sliderCallback, 1e-3, 'Offset', 'mV');

  // Simulation Parameters
  var types = [
    {val: 'edge-ir', text: 'IR Edge TCT'},
    {val: 'p-red', text: 'Red P-Side TCT'},
    {val: 'p-alpha', text: 'AM-241 Source P-Side'},
  ];
  TCTBrowser.select['type'] = SelectInit($('#param_type'), types, 'edge-ir', sliderCallback, 'Type');

  TCTBrowser.sliders['Na'] = SliderInit($('#param_na'), [-2, 12], 7, 0.1, sliderCallback, 1e17, 'Na', '10¹¹ cm⁻³');
  TCTBrowser.sliders['Vbias'] = SliderInit($('#param_bias'), [0, 650], 200, 1, sliderCallback, 1, 'VBias', 'V');
  TCTBrowser.sliders['C'] = SliderInit($('#param_c'), [1, 100], 23.0, 0.5, sliderCallback, 1e-12, 'Cp', 'pF');
  TCTBrowser.sliders['Neh'] = SliderInit($('#param_neh'), [0.5, 20], 8, 0.1, sliderCallback, 1e5, 'Neh', '10⁵');
  TCTBrowser.sliders['Laser'] = SliderInit($('#param_laser'), [-500, 0], -200.0, 1, sliderCallback, 1e-6, 'Position', 'um');
}


$(document).ready(function() {
  TCTBrowser.dataset_table.obj = $('#dataset_list > table');
  TCTBrowser.dataset_table.onclick = clickDataset;
  TCTBrowser.dataset_table.isselected = function(id) {
      return id == TCTBrowser.selected_dataset
  };

  TCTBrowser.scan_table.obj = $('#entry_list > table');
  TCTBrowser.scan_table.onclick = clickScan;
  TCTBrowser.scan_table.isselected = function(id) {
    // TODO Does comparison of lists work like this?!?
    return TCTBrowser.plot.trace == [TCTBrowser.selected_dataset, id];
  };

  TCTBrowser.plot.obj = document.getElementById('tct_plot');

  initSliders();

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
