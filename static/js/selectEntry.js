function SelectInit(dom_obj, value_choices, value_default, select_cb, label='') {
  var select = $('<select>');
  $(value_choices).each(function() {
    var option = $('<option>').attr('value', this.val).text(this.text);
    if(this.val == value_default) {
      option.attr('selected')
    }
    select.append(option);
  });

  var inputgroup = $('<div>').addClass('input-group')
  inputgroup.append(
      $('<div>').append(
          $('<span>').addClass('input-group-text').text(label)
      ).addClass('input-group-prepend')
  )
  .append(
    select.addClass('form-control')
  );

  select.val(value_default);

  select.on('change', function() {
    select_cb();
  });

  dom_obj.append(
    $('<div>').addClass('container-fluid').append(
      $('<div>)').addClass('row').addClass('align-items-center')
        .append($('<div>').addClass('input-wrapper').addClass('col-4').append(inputgroup))
    )
  );

  var entry = {
    obj: dom_obj,
    choices: value_choices,
    default: value_default,
  };

  return entry;
}

function SelectValue(select) {
  return $('select', select.obj).val();
}
