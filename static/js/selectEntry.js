function SelectInit(dom_obj, value_choices, value_default, select_cb, label='') {
  var select = $('<select>');
  $(value_choices).each(function() {
    var option = $('<option>').attr('value', this.val).text(this.text);
    if(this.val == value_default) {
      option.attr('selected')
    }
    select.append(option);
  });

  var inputgroup = $('<div>').addClass('input-group').addClass('input-group-sm')
  inputgroup.append($('<span>').addClass('input-group-text').text(label))
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
        .append($('<div>').addClass('input-wrapper').addClass('col-6').append(inputgroup))
    )
  );

  var entry = {
    obj: dom_obj,
    choices: value_choices,
    default: value_default,
  };

  return entry;
}

function SelectSetValue(select, value) {
  $('select', select.obj).val(value);
}

function SelectValue(select) {
  return $('select', select.obj).val();
}
