function SliderInit(dom_obj, value_range, value_default, step, slider_cb, factor=1, label='', unit='') {
  var slider = $('<div>').addClass('slider');

  var input = $('<input>').addClass('slidervalue').attr('type', 'text');
  var inputgroup = $('<div>').addClass('input-group')
  inputgroup.append(
      $('<div>').append(
          $('<span>').addClass('input-group-text').text(label)
      ).addClass('input-group-prepend')
  )
  .append(input.addClass('form-control'))
  .append(
      $('<div>').append(
          $('<span>').addClass('input-group-text').text(unit)
      ).addClass('input-group-append')
  );

  input.val(value_default);

  slider.slider({
    min: value_range[0], max: value_range[1], step: step, value: value_default,
    stop: function(event, ui) {
        input.val(ui.value);

        slider_cb();
    }
  });

  input.change(function() {
    var value = $(this).val();

    if(value < value_range[0]) {
      slider.slider("option", "value", value_range[0]);
    } else if(value > value_range[1]) {
      slider.slider("option", "value", value_range[1]);
    } else {
      slider.slider("option", "value", value);
    }

    slider_cb();
  });

  dom_obj.append(
    $('<div>').addClass('container-fluid').append(
      $('<div>)').addClass('row').addClass('align-items-center')
        .append($('<div>').addClass('input-wrapper').addClass('col-4').append(inputgroup))
        .append($('<div>').addClass('slider-wrapper').addClass('col-8').append(slider))
    )
  );

  var entry = {
    obj: dom_obj,
    range: value_range,
    default: value_default,
    step: step,
    factor: factor,
  };

  return entry;
}

function SliderValue(slider) {
  var value = parseFloat($('input.slidervalue', slider.obj).val());
  if(isNaN(value)) {
    value = slider.default;
  }
  return value*slider.factor;
}
