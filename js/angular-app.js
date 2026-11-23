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
          var error = new Error(data.error || 'The server could not be reached.');
          // Keep the HTTP status on the error. A caller sometimes needs to
          // tell "you are not signed in" (401) or "not your role" (403) apart
          // from a real failure, and the message alone cannot carry that.
          error.status = response.status;
          throw error;
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
          /** The packages addressed to whoever is signed in. */
          myPackages: function () {
            return $http.get('../api/my-packages.php').then(unwrap, problem);
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
      '$rootScope',
      function ($http, $interval, $rootScope) {
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

          /**
           * Subscribe to the server-sent-event stream instead of polling, and
           * fall back to polling when the browser has no EventSource or the
           * stream cannot be opened. Returns a cancel function either way, so
           * the caller does not need to know which one it got.
           *
           * Polling asked "has anything changed?" every four seconds whether
           * or not it had. The runtime already knows when a cart moves, so the
           * stream lets it say so instead of being asked.
           */
          subscribe: function (onData) {
            var self = this;

            if (typeof window.EventSource !== 'function') {
              return self.poll(4000, onData);
            }

            var source;
            try {
              source = new window.EventSource(TELEMETRY + '/telemetry/stream');
            } catch (err) {
              return self.poll(4000, onData);
            }

            var fallbackStop = null;

            source.onmessage = function (event) {
              var data;
              try {
                data = JSON.parse(event.data);
              } catch (err) {
                return; // a half-delivered frame is skipped, not fatal
              }

              // Older builds of the runtime streamed a bare array while the
              // REST endpoint returned { ok, carts, threshold }. Normalising
              // here means the caller reads one shape whichever it receives.
              if (Array.isArray(data)) {
                data = { ok: true, carts: data };
              }

              // EventSource fires outside AngularJS, so the digest has to be
              // asked for explicitly or the view never repaints. $applyAsync
              // coalesces bursts rather than throwing "$digest already in
              // progress" when two frames land together.
              $rootScope.$applyAsync(function () {
                onData(data);
              });
            };

            source.onerror = function () {
              // The browser retries a dropped stream on its own, so only a
              // stream that never opened is treated as unsupported.
              if (source.readyState === window.EventSource.CLOSED && fallbackStop === null) {
                fallbackStop = self.poll(4000, onData);
              }
            };

            return function () {
              source.close();
              if (fallbackStop !== null) {
                fallbackStop();
              }
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
      '$rootScope',
      'api',
      function ($scope, $rootScope, api) {
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
              // $broadcast from the root, not $emit: the portals that care
              // are siblings of this controller, and an $emit only travels up
              // its own parents, so a sibling would never hear it.
              $rootScope.$broadcast('campuseco:signedin', res.user);
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
            $rootScope.$broadcast('campuseco:signedout');
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

        // Live cart telemetry, pushed from the Node runtime over server-sent
        // events. Falls back to polling by itself if the stream is unavailable.
        var stop = telemetry.subscribe(function (data) {
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

        /* "My packages" is only meaningful for someone signed in, so the
           panel stays hidden until the server says who they are. Tracking a
           single number by hand still works signed out. */
        $scope.mine = null;
        $scope.mineTotals = null;
        $scope.mineError = '';

        function clearMine() {
          $scope.mine = null;
          $scope.mineTotals = null;
          $scope.mineError = '';
        }

        $scope.loadMine = function () {
          // Ask who is signed in before asking for their packages. Calling
          // my-packages.php first and catching the 401 works, but it means
          // every signed-out visit fires a request that is certain to be
          // refused and logs a red line in the console for a page that is
          // behaving correctly.
          api
            .me()
            .then(function (res) {
              if (!res.user || res.user.role !== 'enduser') {
                clearMine();
                return null;
              }
              return api.myPackages().then(function (mine) {
                $scope.mine = mine.packages;
                $scope.mineTotals = mine.totals;
                $scope.mineError = '';
              });
            })
            .catch(function (e) {
              clearMine();
              // A refusal here is a signed-out visitor, not a fault.
              if (e.status !== 401 && e.status !== 403) {
                $scope.mineError = e.message;
              }
            });
        };

        /** Track one of my own packages without retyping the number. */
        $scope.trackMine = function (tracking) {
          $scope.lookup.tracking = tracking;
          $scope.track();
        };

        // AuthCtrl broadcasts from the root scope whenever the session
        // changes, so the list follows signing in and out without a reload.
        $scope.$on('campuseco:signedin', function () {
          $scope.loadMine();
        });
        $scope.$on('campuseco:signedout', clearMine);

        $scope.loadMine();

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
