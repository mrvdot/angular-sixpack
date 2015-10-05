## Angular Sixpack

### Overview

Angular Sixpack is a helpful module for integrating with Seatgeek's open source A/B testing platform Sixpack ([Server][sixpack-server] and [JS Library][sixpack-client] combo). It provides an easy way to implement variations and conversion tracking within your existing Angular application.

### Installation

1. If you haven't installed the [server][sixpack-server]/[client][sixpack-client] pair yet, do that first, then return here to continue with this module.
2. Use bower to install the angular-sixpack module via `bower install --save angular-sixpack` or alternatively just clone this repo into your project.
3. Make sure the `angular-sixpack.js` file is included in your index.html file *after* the sixpack client library. Note, you will also need to include the `angular-cookies.js` file if you're not already doing so.
4. In your angular app module, add `mvdSixpack` as a requirement, ie:
    ```
    angular.module('myApp', ['mvdSixpack'])
    ```
5. You can then configure the sixpack provider via your module's config block. Currently the only two options are:
    - `debug` which will log to console each action sixpack is taking
    - `baseUrl` which should point to your sixpack server (the default is `http://localhost:5000`)

```
angular.module('myApp', ['mvdSixpack'])
    .config(function(sixpackProvider) {
        sixpackProvider.setOptions({
            debug: true,
            baseUrl: 'http://sixpack.example.com:5000'
        })
    });
```

### Usage
Angular Sixpack provides a service and a few helper directives to handle the most common A/B testing use cases.

#### Directives
##### Switch
This directive is modeled off the standard `ng-switch` setup, so integration should feel familiar. A basic test can be easily set up as demoed below:

```
<div sixpack-switch="my_first_test">
   <h1 sixpack-default>My control header</h1>
   <h1 sixpack-when="fancy">My classy header</h1>
   <h1 sixpack-when="boring">Definitely exciting here</h1>
</div>
```

This test will result in the sixpack server creating (or using, if it already exists) a test called "my_first_test" with three varations, the "default" (which is registered as a control), and "fancy" and "boring" as alternatives. 

_It's important to note that if you use `sixpack-default` anywhere within the switch, it will be registered as the control. If you don't have a default, however, sixpack will still display the "first" one it receives as a control_

##### Convert
In order to actually get any use out of the A/B testing setup, you'll want to be able to track conversions as well. Tracking a conversion is as simple as adding a `sixpack-convert` attribute to an element:
```
<button type="submit" sixpack-convert="my_first_test">Sign up!</button>
```
By default, this directive will bind to the click event on it's element (without affecting any other click handlers). If you'd prefer to bind to a different event, just use the `on` attribute (ie: `on="focus"`) as well. Additionally, if you pass a specific test through to the `sixpack-convert` attribute, the conversion will only be logged for that tests. You can optionally leave it blank and the module will log the conversion for every active test currently running.

#### Service
Along with the directives above, angular sixpack comes with a service called `sixpack` that you can use if you want to do more advanced testing and need to create/run tests and record conversions from within your other services/controllers/etc. The service exposes two methods: `participate` and `convert`, and can be used as seen below:

```
angular.controller('MyController', function ($scope, sixpack) {
    $scope.myMessage = "I don't know what to say";

    // participate takes three parameters:
    // - a test name
    // - an array of variations (again, first is considered the 'control')
    // - a callback that receives the chosen variation (and optionally the full response as the second parameter)
    sixpack.participate('myControllerTest', ['default', 'awesomeness', 'boring'], function (chosenVariation, rawResponse) {
        console.log('raw response', rawResponse);// You shouldn't normally need this
        // Note, this callback is wrapped in a $timeout, so any changes on the $scope will be automatically applied
        $scope.myMessage = "Now I'm thinking about " + chosenVariation;
    });

    $scope.userDoesSomethingAwesome = function () {
        // convert takes two parameters, both optional
        // - a test name (if left out, will record the conversion for all tests)
        // - a callback that's triggered when the conversion is done
        sixpack.convert('myControllerTest', function (result) {
            // This callback is generally unneeded, but can be useful if you're going to navigate to a different page and want to make sure the conversion was recorded before moving on
            console.log('sixpack response for conversion', result);
        });
    }
});
```

### Closing thoughts
This is still a pretty early version, so please submit an issue/thought if you find any bugs or think there's something that could be better. Or, even better, fork it, PR it, and add your stamp.

Thanks, hope you enjoy it.

[sixpack-server]: https://github.com/seatgeek/sixpack "Sixpack Server library"
[sixpack-client]: https://github.com/seatgeek/sixpack-js "Sixpack Javascript Client"
