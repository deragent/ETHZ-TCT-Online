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
      var tr = $('<tr>').addClass('note')
        .append($('<td>')
          .text('Use filter to see additional entries.')
          .attr('colSpan', table.columns.length))
        .appendTo(table.obj.find('tbody'));

      return false;
    }

    // Apply the filters
    if(Object.keys(filters).length > 0) {
      var show = true;

      for(key in filters) {
        value = (key != '_prefix' ? item[key] : id);

        if(!filters[key].test(value)) {
          show = false;
        }
      };

      if(!show) return;
    }

    // Add the line to the table
    var tr = $('<tr>').addClass('entry');

    for(cc in table.columns) {
      if(table.columns[cc] == '_prefix') {
        tr.append($('<td>').text(id));
      } else {
        tr.append($('<td>').text(item[table.columns[cc]]));
      }
    }

    if(table.isselected(id)) {
      tr.addClass('selected');
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
