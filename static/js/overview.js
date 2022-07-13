var TCTOverivew = {
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
  TCTOverivew.selected_dataset = id;

  // showPlotFile(id, 0);

  $.getJSON(BASE_URL + "dataset/"+id, function(data){

    var info = $('#dataset_info table');
    info.empty();

    for(key in data.info) {
      var tr = $('<tr>');
      tr.append($('<td>').text(key));
      tr.append($('<td>').text(data.info[key]));
      tr.appendTo(info);
    }

    $.getJSON(BASE_URL + "dataset/"+id+"/plot", function(data_plots){
      var list = $('#dataset_plots ul');
      list.empty();

      for(idx in data_plots.plots) {
        var li = $('<li>').addClass('list-group-item')
          .text(data_plots.plots[idx]);

        li.click(function() {
          showPlotFile(id, idx);
        });

        li.appendTo(list)
      }
    });
  });
}

function loadDatasets() {
    $.getJSON(BASE_URL + "dataset", function(data) {
      TCTOverivew.dataset_table.data = data;
      fillTable(TCTOverivew.dataset_table, {});

      resetFilter(TCTOverivew.dataset_table)
    });
}

function init() {
  createTable(TCTOverivew.dataset_table);
  loadDatasets();
  // parseHash();
}


$(document).ready(function() {
  TCTOverivew.dataset_table.obj = $('#dataset_list > table');
  TCTOverivew.dataset_table.onclick = selectDataset;
  TCTOverivew.dataset_table.isselected = function(id) {
      return id == TCTOverivew.selected_dataset
  };

  $('#btn_refresh').click(function(){
    $.get(BASE_URL + 'reload', init);
  });

  init();
});
