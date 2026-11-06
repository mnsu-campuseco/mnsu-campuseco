/**
 * MNSU-CampusEco — Phase 3 AngularJS client (Tasks 3.1 and 3.3).
 *
 * Phase 2 kept the whole dataset in localStorage and redrew the DOM with jQuery.
 * This module replaces that: every read and write is an asynchronous $http call
 * carrying JSON, and the forms bind straight to model variables with ng-model,
 * so typing in a field updates the model and every list reading that model
 * without a single manual DOM write.
 *
 * The PHP API is same-origin. The Node telemetry runtime is not, which is why it
 * has its own base URL and sends CORS headers.
 */
/* global angular */
(function () {
  'use strict';

  var TELEMETRY = 'http://127.0.0.1:3000';

  angular
    .module('campusEco', [])

    /* ----------------------------------------------------------------
     * One place that knows how to talk to the PHP API.
     * ---------------------------------------------------------------- */
    .factory('api', [
      '$http',
      function ($http) {
        function unwrap(response) {
          return response.data;
        }
        function problem(response) {
          var data = response.data || {};
          throw new Error(data.error || 'The server could not be reached.');
        }

        return {
          // auth
          me: function () {
            return $http.get('../api/auth.php?action=me').then(unwrap, problem);
          },
          login: function (username, password) {
            return $http
              .post('../api/auth.php?action=login', { username: username, password: password })
              .then(unwrap, problem);
          },
          logout: function () {
            return $http.post('../api/auth.php?action=logout', {}).then(unwrap, problem);
          },

          // reference data
          destinations: function () {
            return $http.get('../api/destinations.php').then(unwrap, problem);
          },
          fleet: function () {
            return $http.get('../api/fleet.php').then(unwrap, problem);
          },
          reportBattery: function (cartId, battery) {
            return $http
              .post('../api/fleet.php', { cart_id: cartId, battery: battery })
              .then(unwrap, problem);
          },

          // packages
          packages: function (filters) {
            return $http
              .get('../api/packages.php', { params: filters || {} })
              .then(unwrap, problem);
          },
          checkIn: function (pkg) {
            return $http.post('../api/packages.php', pkg).then(unwrap, problem);
          },

          // deliveries
          claim: function (packageId, courierId, cartId) {
            return $http
              .post('../api/claims.php', {
                package_id: packageId,
                courier_id: courierId,
                cart_id: cartId,
              })
              .then(unwrap, problem);
          },
          advance: function (packageId, courierId, status, note) {
            return $http
              .post('../api/milestones.php', {
                package_id: packageId,
                courier_id: courierId,
                status: status,
                note: note || '',
              })
              .then(unwrap, problem);
          },

          // recipient
          track: function (tracking) {
            return $http
              .get('../api/track.php', { params: { tracking: tracking } })
              .then(unwrap, problem);
          },
          sign: function (tracking, name) {
            return $http
              .post('../api/receipts.php', { tracking: tracking, name: name })
              .then(unwrap, problem);
          },
          metrics: function (tracking) {
            return $http
              .get('../api/metrics.php', { params: tracking ? { tracking: tracking } : {} })
              .then(unwrap, problem);
          },
        };
      },
    ])

    /* ----------------------------------------------------------------
     * The Node telemetry runtime. Separate origin, separate concern.
     * ---------------------------------------------------------------- */
    .factory('telemetry', [
      '$http',
      '$interval',
      function ($http, $interval) {
        return {
          carts: function () {
            return $http.get(TELEMETRY + '/telemetry/carts').then(function (r) {
              return r.data;
            });
          },
          alerts: function () {
            return $http.get(TELEMETRY + '/dispatch/alerts').then(function (r) {
              return r.data;
            });
          },
          /** Poll the snapshot; returns a cancel function. */
          poll: function (everyMs, onData) {
            var self = this;
            function tick() {
              self.carts().then(onData, angular.noop);
            }
            tick();
            var handle = $interval(tick, everyMs || 4000);
            return function () {
              $interval.cancel(handle);
            };
          },
        };
      },
    ])

    /* ----------------------------------------------------------------
     * Shared sign-in, used by every portal.
     * ---------------------------------------------------------------- */
    .controller('AuthCtrl', [
      '$scope',
      'api',
      function ($scope, api) {
        $scope.credentials = { username: '', password: '' };
        $scope.user = null;
        $scope.error = '';
        $scope.busy = false;

        api.me().then(function (res) {
          $scope.user = res.user;
        });

        $scope.signIn = function () {
          $scope.error = '';
          $scope.busy = true;
          api
            .login($scope.credentials.username, $scope.credentials.password)
            .then(function (res) {
              $scope.user = res.user;
              $scope.credentials.password = '';
              $scope.$emit('campuseco:signedin', res.user);
            })
            .catch(function (e) {
              $scope.error = e.message;
            })
            .finally(function () {
              $scope.busy = false;
            });
        };

        $scope.signOut = function () {
          api.logout().then(function () {
            $scope.user = null;
            $scope.$emit('campuseco:signedout');
          });
        };
      },
    ])

    /* ----------------------------------------------------------------
     * Hub Operator — check-in and the shared tracking log.
     * ---------------------------------------------------------------- */
    .controller('OperatorCtrl', [
      '$scope',
      'api',
      function ($scope, api) {
        // ng-model binds the check-in form straight to this object.
        $scope.form = { urgent: false };
        $scope.filters = { search: '', status: '' };
        $scope.destinations = [];
        $scope.packages = [];
        $scope.totals = {};
        $scope.statuses = ['At hub', 'Loaded', 'En Route', 'Delivered'];
        $scope.message = '';
        $scope.error = '';
        $scope.busy = false;

        api.destinations().then(function (res) {
          $scope.destinations = res.destinations;
        });

        $scope.load = function () {
          return api.packages($scope.filters).then(function (res) {
            $scope.packages = res.packages;
            $scope.totals = res.totals;
          });
        };

        // Re-query whenever a filter field changes — the list follows the inputs.
        $scope.$watchGroup(['filters.search', 'filters.status'], function () {
          $scope.load();
        });

        $scope.checkIn = function () {
          $scope.message = '';
          $scope.error = '';
          $scope.busy = true;
          api
            .checkIn($scope.form)
            .then(function (res) {
              $scope.message = res.package.tracking + ' checked in.';
              $scope.form = { urgent: false };
              return $scope.load();
            })
            .catch(function (e) {
              $scope.error = e.message;
            })
            .finally(function () {
              $scope.busy = false;
            });
        };
      },
    ])

    /* ----------------------------------------------------------------
     * Eco-Transit Crew — shift, queue, claiming and milestones.
     * ---------------------------------------------------------------- */
    .controller('CourierCtrl', [
      '$scope',
      'api',
      'telemetry',
      function ($scope, api, telemetry) {
        $scope.shift = { courier_id: '', cart_id: '' };
        $scope.queue = [];
        $scope.vehicles = [];
        $scope.live = [];
        $scope.threshold = 20;
        $scope.note = '';
        $scope.error = '';
        $scope.message = '';

        $scope.load = function () {
          api.packages().then(function (res) {
            // Urgent first, delivered hidden — the Phase 2 queue() rule.
            $scope.queue = res.packages.filter(function (p) {
              return p.status !== 'Delivered';
            });
          });
          api.fleet().then(function (res) {
            $scope.vehicles = res.vehicles;
            $scope.threshold = res.threshold;
          });
        };

        $scope.claim = function (pkg) {
          $scope.error = '';
          api
            .claim(pkg.id, $scope.shift.courier_id, $scope.shift.cart_id)
            .then(function (res) {
              $scope.message = res.package.tracking + ' claimed.';
              $scope.load();
            })
            .catch(function (e) {
              $scope.error = e.message;
            });
        };

        $scope.advance = function (pkg, status) {
          $scope.error = '';
          api
            .advance(pkg.id, $scope.shift.courier_id, status, $scope.note)
            .then(function (res) {
              $scope.message = res.package.tracking + ' → ' + res.package.status;
              $scope.note = '';
              $scope.load();
            })
            .catch(function (e) {
              $scope.error = e.message;
            });
        };

        // Live cart telemetry from the Node runtime.
        var stop = telemetry.poll(4000, function (data) {
          $scope.live = data.carts;
        });
        $scope.$on('$destroy', stop);

        $scope.load();
      },
    ])

    /* ----------------------------------------------------------------
     * Campus End-User — tracking, signing, carbon metrics.
     * ---------------------------------------------------------------- */
    .controller('EndUserCtrl', [
      '$scope',
      'api',
      function ($scope, api) {
        $scope.lookup = { tracking: 'CE-20261001' };
        $scope.signature = { name: '' };
        $scope.package = null;
        $scope.history = [];
        $scope.metrics = null;
        $scope.error = '';
        $scope.message = '';

        $scope.track = function () {
          $scope.error = '';
          $scope.message = '';
          api
            .track($scope.lookup.tracking)
            .then(function (res) {
              $scope.package = res.package;
              $scope.history = res.history;
              return api.metrics($scope.lookup.tracking);
            })
            .then(function (res) {
              $scope.metrics = res;
            })
            .catch(function (e) {
              $scope.package = null;
              $scope.history = [];
              $scope.error = e.message;
            });
        };

        $scope.sign = function () {
          $scope.error = '';
          api
            .sign($scope.lookup.tracking, $scope.signature.name)
            .then(function (res) {
              $scope.package = res.package;
              $scope.signature.name = '';
              $scope.message = 'Receipt recorded. Thank you.';
            })
            .catch(function (e) {
              $scope.error = e.message;
            });
        };

        $scope.track();
      },
    ]);
})();
