var TCTOverview = {
  selected_dataset: null,
  dataset_table: {
    obj: null,
    columns: ['_prefix', 'laser', 'wafer', 'sample', 'side', 'operator'],
    data: {},
    onclick: function(){ console.log('test click'); },
    isselected: function(id){ return false; },
  },
};

function showPlotFile(dataset, idx) {
  var plot = $('#plot_view');

  plot.empty()

  var object = $('<object>')
    .attr('data', BASE_URL + 'dataset/' + dataset + '/plot/' + idx)
    .attr('type', 'application/pdf')
    .width('100%')
    .height('100%');

  object.appendTo(plot);
}

// Event handling functions
function selectDataset() {
  $(this).addClass('selected').siblings().removeClass('selected');

  var id = $($(this).children('td')[0]).html();

  return showDataset(id);
}

function showDataset(id) {
  TCTOverview.selected_dataset = id;

  $.getJSON(BASE_URL + "dataset/"+id, function(data){

    $('#dataset_info span.share_link a').attr('href', createShareLink()).text(id);
    $('#dataset_info span.download_link a').attr('href', BASE_URL+"dataset/"+id+"/download").text('Download');

    var info = $('#dataset_info table');
    info.empty();

    for(key in data.info) {
      var tr = $('<tr>');
      tr.append($('<td>').text(key));
      tr.append($('<td>').text(data.info[key]));
      tr.appendTo(info);
    }

    // Add list of scan parameters
    var tr = $('<tr>');
    tr.append($('<td>').text('scan-parameters'));
    var text = '';
    for(key in data.changed_columns) {
      if(data.changed_columns[key] != '_prefix') {
        text += data.changed_columns[key];
        if(key < data.changed_columns.length-1) {
          text += ' / ';
        }
      }
    }
    tr.append($('<td>').text(text));
    tr.appendTo(info);

    // Present
    var config = $('#dataset_config code');
    config.text(data.config_file);

    $.getJSON(BASE_URL + "dataset/"+id+"/plot", function(data_plots){
      var list = $('#dataset_plots ul');
      list.empty();

      for(var idx in data_plots.plots) {
        var li = $('<li>').addClass('list-group-item')
          .text(data_plots.plots[idx]);

        // We manually create a new scope to capture the value of idx!
        (function (idx)
        {
          li.click(function() {
            showPlotFile(id, idx);
          });
        }) (idx);

        li.appendTo(list)
      }
    });
  });
}

function loadDatasets() {
    $.getJSON(BASE_URL + "dataset", function(data) {
      TCTOverview.dataset_table.data = data;
      fillTable(TCTOverview.dataset_table, {});

      resetFilter(TCTOverview.dataset_table)
    });
}

function parseHash() {
  if(window.location.hash) {
    var hash = decodeURI(window.location.hash.substring(1));
    console.log(hash);

    try {
      showDataset(hash);
    }
    catch(err) {
      return;
    }
  }
}

function createShareLink() {
  var base = window.location.href.split("#")[0];

  return base + '#' + TCTOverview.selected_dataset;
}

function init() {
  createTable(TCTOverview.dataset_table);
  loadDatasets();
  parseHash();
}


$(document).ready(function() {
  TCTOverview.dataset_table.obj = $('#dataset_list > table');
  TCTOverview.dataset_table.onclick = selectDataset;
  TCTOverview.dataset_table.isselected = function(id) {
      return id == TCTOverview.selected_dataset
  };

  $('#btn_refresh').click(function(){
    $.get(BASE_URL + 'reload', init);
  });

  init();
});
