/*
 * Patches the Ajax.Request of Prototype to change sum always after ajax-requests (in callback)
 */

OriginalAjaxRequest = Ajax.Request;
AjaxRequestProxy = Class.create(OriginalAjaxRequest, {

    initialize: function($super, url, options) {
        originalCallback = options['onSuccess'];

        callbackProxy = function(transport) {
            originalCallback(transport);
            lfndsOneStep.lfnds_changeSum.updateSums();
            lfndsOneStep.lfnds_changeSum.changeSumValue();
        }

        options['onSuccess'] = callbackProxy;

        $super(url, options);

    }
});
AjaxRequestProxy.Events = Ajax.Request.Events;
Ajax.Request = AjaxRequestProxy;