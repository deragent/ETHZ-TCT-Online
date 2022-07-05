var TCTBrowser = {
  dataset_table: {
    obj: null,
    columns: ['_prefix', 'laser', 'wafer', 'sample', 'side', 'operator'],
    data: {},
    onclick: function(){ console.log('test click'); },
    selected: null,
  },

  scan_table: {
    obj: null,
    data: {},
    columns: [],
    onclick: function(){ console.log('test click'); },
    selected: null,
  },
  plot: {
    obj: null,
    traces: {},
  },
};

function createTable(table) {
  table.obj.find('thead').empty()
  table.obj.find('tbody').empty()

  var tr = $('<tr class="filters">')
  for(cc in table.columns) {
      tr.append(
        $('<th>').append(
          $('<input type="text">')
            .attr('placeholder', (table.columns[cc] == '_prefix' ? 'ID' : table.columns[cc]))
            .attr('data-key', table.columns[cc])
        )
      );
  }
  tr.appendTo(table.obj.find('thead'));

  resetFilter(table);
  enableTableFilter(table);
}

function fillTable(table, filters) {
  table.obj.find('tbody').empty()

  MAX_COUNT = 100;

  var count = 0;
  $.each(table.data, function(id, item){
    if(count >= MAX_COUNT) {
      return;
    }

    // Apply the filters
    if(Object.keys(filters).length > 0) {
      var show = true;

      for(key in filters) {
        value = id;
        if(key != '_prefix') {
          value = item[key]
        }

        if(!filters[key].test(value)) {
          show = false;
        }
      };

      if(!show) {
        return;
      }
    }

    // Add the line to the table
    var tr = $('<tr>')

    for(cc in table.columns) {
      if(table.columns[cc] == '_prefix') {
        tr.append($('<td>').text(id));
      } else {
        tr.append($('<td>').text(item[table.columns[cc]]));
      }
    }

    if(id == table.selected) {
      tr.addClass('selected')
    }

    tr.appendTo(table.obj.find('tbody'));
    tr.click(table.onclick);

    count += 1;
  });
}

function resetFilter(table) {
  table.obj.find('thead input').each(function(i, obj) {
    $(this).val('');
  });
}

function enableTableFilter(table) {
  table.obj.find('thead input').change(function() {
    var filters = {}

    // Generate all the filter regex
    table.obj.find('thead input').each(function(i, obj) {
      var value = $(this).val();
      var key = $(this).attr('data-key');

      if(value && value.length > 0) {
        filters[key] = new RegExp(value, 'i');
      }
    });

    fillTable(table, filters);
  });
}

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

  for(dd in plot.obj.data) {
    console.log(plot.obj.data[dd]);
  }
}

function clearPlot(plot) {
  Plotly.deleteTraces(plot.obj);
}


// Event handling functions
function selectDataset() {
  $(this).addClass('selected').siblings().removeClass('selected');

  var id = $($(this).children('td')[0]).html();
  TCTBrowser.dataset_table.selected = id;

  $.getJSON("/dataset/"+id, function(data){
    TCTBrowser.scan_table.columns = data.changed_columns;
    TCTBrowser.scan_table.data = data.changed_data;
    TCTBrowser.scan_table.selected = null;

    createTable(TCTBrowser.scan_table);
    fillTable(TCTBrowser.scan_table, {});
  });
}

function selectScan() {
  $(this).addClass('checked');

  var id = $($(this).children('td')[0]).html();
  TCTBrowser.scan_table.selected = id;

  $.getJSON("/dataset/" + TCTBrowser.dataset_table.selected + '/' + id, function(data){
    addTrace(TCTBrowser.plot, TCTBrowser.dataset_table.selected, id, data);
  });
}

function loadDatasets() {
    $.getJSON("/dataset", function(data) {
      TCTBrowser.dataset_table.data = data;
      fillTable(TCTBrowser.dataset_table, {});

      resetFilter(TCTBrowser.dataset_table)
    });
}


function init() {
  createTable(TCTBrowser.dataset_table);
  loadDatasets();
}

$(document).ready(function() {
  TCTBrowser.dataset_table.obj = $('#dataset_list > table');
  TCTBrowser.dataset_table.onclick = selectDataset;

  TCTBrowser.scan_table.obj = $('#entry_list > table');
  TCTBrowser.scan_table.onclick = selectScan;

  TCTBrowser.plot.obj = document.getElementById('tct_plot');

  $('#btn_refresh').click(function(){
    $.get('/reload', init());
  });

  initPlot(TCTBrowser.plot);
  init();
});
