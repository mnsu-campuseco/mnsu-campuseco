/* Shared jQuery UI controller. User-provided strings are inserted with .text(), never HTML. */
(function ($, Eco) {
  'use strict';
  const KEY = 'campuseco.phase2.v2';
  const SHIFT_KEY = 'campuseco.shift.v2';
  let state,
    shift = null,
    persistent = true,
    damaged = false;
  let tracked = 'CE-20261001';
  let previewTracking = '';
  const page = $('body').data('page');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  $.fx.off = reducedMotion;
  function warning(message) {
    $('#storage-warning').text(message).prop('hidden', false);
  }
  function message(text, error = false) {
    $('#feedback').text(text).toggleClass('error', error).prop('hidden', false);
  }
  function load() {
    if (!persistent) return state;
    let raw;
    try {
      raw = localStorage.getItem(KEY);
    } catch {
      persistent = false;
      warning('Browser storage is unavailable. Changes last only until this page is closed.');
      return state || Eco.seed();
    }
    if (!raw) return Eco.seed();
    try {
      const restored = Eco.hydrate(JSON.parse(raw));
      if (damaged) $('#storage-warning').prop('hidden', true);
      damaged = false;
      return restored;
    } catch {
      damaged = true;
      warning(
        'Saved demo data could not be read. Use Reset demo to restore samples before making changes.'
      );
      return state || Eco.seed();
    }
  }
  function persist(next) {
    if (persistent) {
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        persistent = false;
        warning('Browser storage is full or blocked. Further changes last only on this page.');
      }
    }
    state = next;
  }
  function saveShift() {
    try {
      shift
        ? sessionStorage.setItem(SHIFT_KEY, JSON.stringify(shift))
        : sessionStorage.removeItem(SHIFT_KEY);
    } catch {
      warning('Shift storage is unavailable. Start your shift again after refreshing.');
    }
  }
  // Reload the latest data before every mutation so another portal's changes are retained.
  function change(operation, success) {
    try {
      const next = Eco.hydrate(JSON.parse(JSON.stringify(load())));
      if (damaged) throw new Error('Reset the unreadable demo data before making changes.');
      operation(next);
      persist(next);
      render();
      message(success);
      return true;
    } catch (error) {
      message(error.message, true);
      return false;
    }
  }
  function cell(row, value, label) {
    return $('<td>').attr('data-label', label).text(value).appendTo(row);
  }
  function badge(status) {
    return $('<span>')
      .addClass('badge')
      .toggleClass('complete', status === 'Delivered')
      .text(status);
  }
  function time(value) {
    return new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  }
  function empty(body, columns, text) {
    $('<tr>')
      .append($('<td>').attr('colspan', columns).addClass('empty-state').text(text))
      .appendTo(body);
  }
  function options(selector, records, placeholder) {
    const select = $(selector),
      value = select.val();
    select.empty().append($('<option>').val('').text(placeholder));
    records.forEach(([id, label]) => select.append($('<option>').val(id).text(label)));
    if (records.some(([id]) => id === value)) select.val(value);
  }
  function stats(selector) {
    const delivered = state.packages.filter((p) => p.status === 'Delivered').length;
    const values = [
      ['Packages received', state.packages.length],
      ['Active deliveries', state.packages.length - delivered],
      ['Delivered', delivered],
    ];
    $(selector).empty();
    values.forEach(([label, value]) =>
      $('<div>')
        .addClass('stat')
        .append($('<strong>').text(value), $('<span>').text(label))
        .appendTo(selector)
    );
  }
  function renderOperator() {
    stats('#operator-stats');
    const query = String($('#log-search').val() || '')
        .trim()
        .toLowerCase(),
      status = $('#log-status').val();
    const body = $('#package-log tbody').empty();
    const packages = state.packages.filter(
      (p) =>
        (!status || status === p.status) &&
        `${p.tracking} ${p.destination}`.toLowerCase().includes(query)
    );
    packages
      .slice()
      .reverse()
      .forEach((p) => {
        const row = $('<tr>');
        cell(row, p.tracking, 'Tracking number');
        cell(row, p.destination, 'Destination');
        cell(row, `${p.weight} lb · ${p.dimensions.join(' × ')} in`, 'Weight / dimensions');
        cell(row, p.urgent ? 'Urgent' : 'Standard', 'Priority');
        cell(row, '', 'Status').append(badge(p.status));
        cell(row, p.courier || 'Unassigned', 'Courier');
        body.append(row);
      });
    if (!packages.length) empty(body, 6, 'No packages match these filters.');
  }
  function renderCrew() {
    const cart = state.vehicles.find((v) => v.id === shift?.cart);
    $('#shift-summary').text(
      shift
        ? `Active shift: ${shift.id} · ${shift.cart} · ${cart?.battery ?? '—'}% battery`
        : 'Start a shift to claim deliveries. Demo driver: ECO-0417.'
    );
    $('#end-shift').prop('disabled', !shift);
    options(
      '#cart',
      state.vehicles.map((v) => [v.id, `${v.id} · ${v.route} · ${v.battery}%`]),
      'Select a cart'
    );
    const mine = state.packages.filter((p) => p.courier === shift?.id && p.status !== 'Delivered');
    options(
      '#package',
      mine.map((p) => [p.tracking, `${p.tracking} · ${p.status}`]),
      'Select your package'
    );
    const body = $('#route-queue tbody').empty();
    const packages = Eco.queue(state.packages).filter(
      (p) => !$('#mine-only').prop('checked') || p.courier === shift?.id
    );
    packages.forEach((p) => {
      const row = $('<tr>');
      cell(row, p.tracking, 'Tracking number');
      cell(row, p.destination, 'Destination');
      cell(row, p.urgent ? 'Urgent' : 'Standard', 'Priority');
      cell(row, '', 'Status').append(badge(p.status));
      const action = cell(row, '', 'Action');
      if (p.courier)
        action.text(p.courier === shift?.id ? `Yours · ${p.cart}` : `Assigned: ${p.courier}`);
      else
        $('<button>')
          .attr({ type: 'button', 'data-claim': p.tracking })
          .text('Claim')
          .prop('disabled', !shift || !cart || cart.battery < 20)
          .appendTo(action);
      body.append(row);
    });
    if (!packages.length) empty(body, 5, 'No active deliveries in this view.');
    $('#fleet-cards').empty();
    state.vehicles.forEach((v) =>
      $('<article>')
        .addClass('card fleet-card')
        .append(
          $('<h3>').text(v.id),
          $('<p>').addClass('battery-value').text(`${v.battery}%`),
          $('<progress>').attr({ max: 100, value: v.battery, 'aria-label': `${v.id} battery` }),
          $('<p>').text(`${v.route} · ${v.battery < 20 ? 'Needs charging' : 'Ready for dispatch'}`)
        )
        .appendTo('#fleet-cards')
    );
    updateMilestone();
  }
  function updateMilestone() {
    const p = state.packages.find((p) => p.tracking === $('#package').val());
    if (p) previewTracking = p.tracking;
    const next = p ? Eco.STATUSES[Eco.STATUSES.indexOf(p.status) + 1] : '';
    $('[name="status"]').each(function () {
      $(this)
        .prop('disabled', this.value !== next)
        .prop('checked', this.value === next);
    });
    $('#milestone-form button').prop('disabled', !p);
    const preview =
      p ||
      state.packages.find(
        (item) => item.tracking === previewTracking && item.status === 'Delivered'
      );
    const left =
      !preview || preview.status === 'At hub'
        ? 8
        : preview.status === 'Loaded'
          ? 22
          : preview.status === 'En Route'
            ? 54
            : 88;
    $('#cart-marker')
      .stop(true)
      .animate({ left: `${left}%` }, reducedMotion ? 0 : 650);
    $('#route-caption').text(
      preview
        ? `${preview.tracking} · ${preview.status} · ${preview.destination}. Schematic only; no GPS data.`
        : 'Select your active package to preview its transit stage. Schematic only; no GPS data.'
    );
  }
  function renderTracking() {
    const result = $('#tracking-result').empty(),
      body = $('#tracking-history tbody').empty();
    const p = state.packages.find((p) => p.tracking === tracked);
    if (!p) {
      result.text(`No package found for ${tracked}. Check the number or check it in at the hub.`);
      empty(body, 3, 'No tracking events.');
      return;
    }
    result.append(
      $('<h3>').text(p.tracking),
      badge(p.status),
      $('<p>').text(p.destination),
      $('<p>').text(p.courier ? `${p.courier} · ${p.cart}` : 'Awaiting crew assignment')
    );
    if (p.receipt)
      result.append($('<p>').text(`Received by ${p.receipt.name} · ${time(p.receipt.at)}`));
    p.events
      .slice()
      .reverse()
      .forEach((event) => {
        const row = $('<tr>');
        cell(row, time(event.at), 'Date and time');
        cell(row, event.status, 'Milestone');
        cell(row, event.note || p.destination, 'Details');
        body.append(row);
      });
  }
  function renderEnduser() {
    renderTracking();
    const prefs = state.preferences;
    $('#preferences-summary').text(
      prefs
        ? `${prefs.building} · ${prefs.location} · ${prefs.method === 'hub' ? 'Collect at hub' : prefs.method === 'office' ? 'Office delivery' : 'Front desk'}`
        : 'Choose where and how you receive deliveries.'
    );
    const notifications = state.packages
      .flatMap((p) =>
        p.events.map((e) => ({ ...e, tracking: p.tracking, destination: p.destination }))
      )
      .reverse()
      .filter(
        (e) =>
          !prefs ||
          prefs.notifications[
            e.status === 'At hub' ? 'hub' : e.status === 'Delivered' ? 'delivered' : 'transit'
          ]
      )
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 8);
    const list = $('#notifications').empty();
    notifications.forEach((e) =>
      $('<li>')
        .append(
          badge(e.status),
          $('<h3>').text(e.tracking),
          $('<p>').text(e.note || e.destination),
          $('<time>').attr('datetime', e.at).text(time(e.at))
        )
        .appendTo(list)
    );
    if (!notifications.length)
      $('<li>')
        .text(
          'No notifications in the selected categories. Edit your preferences to change categories.'
        )
        .appendTo(list);
    options(
      '#receipt-package',
      state.packages
        .filter((p) => p.status === 'Delivered' && !p.receipt)
        .map((p) => [p.tracking, `${p.tracking} · ${p.destination}`]),
      'Select a delivered package'
    );
    $('#signoff-form button').prop(
      'disabled',
      !state.packages.some((p) => p.status === 'Delivered' && !p.receipt)
    );
    $('#receipt-summary').text(
      state.packages
        .filter((p) => p.receipt)
        .map((p) => `${p.tracking}: received by ${p.receipt.name} on ${time(p.receipt.at)}`)
        .join(' · ')
    );
    const completed = state.packages.filter((p) => p.status === 'Delivered');
    const distance = completed.reduce((sum, p) => sum + p.distance, 0);
    const metrics = $('#carbon-metrics').empty();
    [
      ['Estimated CO₂ avoided', `${(distance * 0.2).toFixed(1)} kg`],
      ['Electric cart deliveries', completed.length],
      ['Delivery distance', `${distance.toFixed(1)} km`],
    ].forEach(([label, value]) =>
      $('<div>').append($('<dt>').text(label), $('<dd>').text(value)).appendTo(metrics)
    );
    $('#profile-summary').text(
      state.profile
        ? `${state.profile.name} · ${state.profile.role} · ${state.profile.email}`
        : 'No demo profile saved yet.'
    );
  }
  function render() {
    if (page === 'operator') renderOperator();
    if (page === 'courier') renderCrew();
    if (page === 'enduser') renderEnduser();
    if (page === 'home') stats('#home-stats');
  }
  // Native validity still runs before submit; this guard also covers programmatic submissions.
  function form(selector, handler) {
    $(selector).on('submit', function (event) {
      event.preventDefault();
      if (this.reportValidity()) handler.call(this);
    });
  }
  function toggle(button, panel) {
    const expanded = $(button).attr('aria-expanded') === 'true';
    $(button).attr('aria-expanded', String(!expanded));
    if (!expanded) $(panel).hide().prop('hidden', false).stop(true, true).slideDown(200);
    else
      $(panel)
        .stop(true, true)
        .slideUp(200, function () {
          $(this).prop('hidden', true);
        });
  }
  state = load();
  if (!damaged) persist(state);
  try {
    const saved = JSON.parse(sessionStorage.getItem(SHIFT_KEY));
    if (saved && state.vehicles.some((v) => v.id === saved.cart))
      shift = new Eco.EcoCourier(saved.id, saved.cart);
  } catch {
    shift = null;
  }
  options(
    '#destination, #building',
    Eco.DESTINATIONS.map((d) => [d, d]),
    'Select a destination'
  );
  if (shift) $('#driver-id').val(shift.id);
  render();
  if (shift) {
    $('#cart').val(shift.cart);
    $('#battery').val(state.vehicles.find((v) => v.id === shift.cart)?.battery);
  }
  if (state.preferences) {
    const p = state.preferences;
    $('#building').val(p.building);
    $('#delivery-location').val(p.location);
    $('#delivery-notes').val(p.notes);
    $('[name="delivery-method"]').each(function () {
      this.checked = this.value === p.method;
    });
    ['hub', 'transit', 'delivered'].forEach((key) =>
      $(`#notify-${key}`).prop('checked', p.notifications[key])
    );
  }
  if (state.profile) {
    $('#full-name').val(state.profile.name);
    $('#email').val(state.profile.email);
    $('#campus-role').val(state.profile.role);
  }
  form('#checkin-form', function () {
    const data = Object.fromEntries(new FormData(this));
    data.urgent = $('#urgent').prop('checked');
    if (
      change(
        (next) => {
          const pkg = new Eco.Package(data);
          if (next.packages.some((p) => p.tracking === pkg.tracking))
            throw new Error('That tracking number is already checked in.');
          next.packages.push(pkg);
        },
        `Package ${String(data.tracking).toUpperCase()} checked in and added to the route queue.`
      )
    ) {
      this.reset();
      $('#tracking').trigger('focus');
    }
  });
  $('#log-search').on('input', renderOperator);
  $('#log-status').on('change', renderOperator);
  form('#shift-form', function () {
    let candidate;
    if (
      change((next) => {
        const id = String($('#driver-id').val()).trim().toUpperCase(),
          cartId = $('#cart').val();
        candidate = new Eco.EcoCourier(id, cartId);
        const active = next.packages.filter((p) => p.courier === id && p.status !== 'Delivered');
        if (active.some((p) => p.cart !== cartId))
          throw new Error('Finish your active deliveries before switching carts.');
        if (
          next.packages.some(
            (p) => p.cart === cartId && p.courier && p.courier !== id && p.status !== 'Delivered'
          )
        )
          throw new Error('That cart has active deliveries assigned to another driver.');
        const vehicle = next.vehicles.find((v) => v.id === cartId);
        if (!vehicle) throw new Error('Select an available cart.');
        vehicle.reportBattery($('#battery').val());
      }, 'Shift saved. Battery status updated.')
    ) {
      shift = candidate;
      saveShift();
      renderCrew();
    }
  });
  $('#end-shift').on('click', function () {
    state = load();
    if (state.packages.some((p) => p.courier === shift?.id && p.status !== 'Delivered')) {
      message('Complete your claimed deliveries before ending the shift.', true);
      return;
    }
    shift = null;
    saveShift();
    renderCrew();
    $('#shift-form')[0].reset();
    message('Shift ended.');
  });
  // Delegated events also handle rows inserted after the page initially loaded.
  $('#route-queue').on('click', '[data-claim]', function () {
    const tracking = $(this).attr('data-claim');
    if (
      change((next) => {
        if (!shift) throw new Error('Start a shift before claiming a delivery.');
        const pkg = next.packages.find((p) => p.tracking === tracking);
        if (!pkg) throw new Error('Package no longer exists.');
        pkg.claim(
          shift,
          next.vehicles.find((v) => v.id === shift.cart)
        );
      }, `${tracking} claimed. Update its transit milestones below.`)
    ) {
      $('#package').val(tracking);
      updateMilestone();
    }
  });
  $('#package').on('change', updateMilestone);
  $('#cart').on('change', function () {
    $('#battery').val(state.vehicles.find((v) => v.id === this.value)?.battery ?? '');
  });
  $('#mine-only').on('change', renderCrew);
  form('#milestone-form', function () {
    const tracking = $('#package').val();
    change((next) => {
      const pkg = next.packages.find((p) => p.tracking === tracking);
      if (!pkg) throw new Error('Select an active package.');
      pkg.advance($('[name="status"]:checked').val(), shift?.id, $('#note').val());
    }, `${tracking}: transit milestone updated.`);
    $('#note').val('');
  });
  form('#tracking-form', function () {
    tracked = String($('#tracking-number').val()).trim().toUpperCase();
    state = load();
    renderEnduser();
  });
  form('#preferences-form', function () {
    if (
      change((next) => {
        next.preferences = {
          building: $('#building').val(),
          location: String($('#delivery-location').val()).trim(),
          method: $('[name="delivery-method"]:checked').val(),
          notes: String($('#delivery-notes').val()).trim(),
          notifications: {
            hub: $('#notify-hub').prop('checked'),
            transit: $('#notify-transit').prop('checked'),
            delivered: $('#notify-delivered').prop('checked'),
          },
        };
      }, 'Delivery preferences saved on this device.')
    ) {
      toggle('#preferences-toggle', '#preferences-options');
      $('#preferences-toggle').trigger('focus');
    }
  });
  form('#registration-form', function () {
    change((next) => {
      next.profile = {
        name: String($('#full-name').val()).trim(),
        email: String($('#email').val()).trim(),
        role: $('#campus-role').val(),
      };
    }, 'Demo profile saved on this device.');
  });
  form('#signoff-form', function () {
    if (
      change((next) => {
        const pkg = next.packages.find((p) => p.tracking === $('#receipt-package').val());
        if (!pkg) throw new Error('Select a delivered package.');
        if (!$('#receipt-consent').prop('checked'))
          throw new Error('Confirm receipt before signing.');
        pkg.sign($('#signature').val());
      }, 'Receipt confirmed. Your electronic sign-off is saved.')
    )
      this.reset();
  });
  $('#route-toggle').on('click', () => toggle('#route-toggle', '#route-options'));
  $('#preferences-toggle').on('click', () => toggle('#preferences-toggle', '#preferences-options'));
  $('#reset-toggle').on('click', () => toggle('#reset-toggle', '#reset-options'));
  $('#reset-cancel').on('click', () => {
    toggle('#reset-toggle', '#reset-options');
    $('#reset-toggle').trigger('focus');
  });
  $('#reset-confirm').on('click', function () {
    damaged = false;
    state = Eco.seed();
    shift = null;
    saveShift();
    persist(state);
    // A page reload clears all form drafts and filters after the explicit reset.
    window.location.reload();
  });
  $(document).on('keydown', function (event) {
    if (event.key !== 'Escape') return;
    [
      ['#route-toggle', '#route-options'],
      ['#preferences-toggle', '#preferences-options'],
      ['#reset-toggle', '#reset-options'],
    ].forEach(([button, panel]) => {
      if ($(button).attr('aria-expanded') === 'true') {
        toggle(button, panel);
        $(button).trigger('focus');
      }
    });
  });
  $(window).on('storage', function (event) {
    if (event.originalEvent.key === KEY || event.originalEvent.key === null) {
      state = load();
      render();
      message('Demo data updated from another portal tab.');
    }
  });
})(jQuery, CampusEco);
