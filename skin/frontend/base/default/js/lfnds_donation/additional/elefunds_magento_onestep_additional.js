var lfndsOneStep = {};

/*
 * ++ One Step Checkout Specific JavaScript ++
 */

var ElefundsOneStepCheckoutIntegration = function () {
    /*
     * Cache important DOM-Nodes as member-variables
     */
    this.$oneStepMiddleColumn = jQuery('.onestepcheckout-column-middle');
    this.$elefundsModule = jQuery('#elefunds-form');

    this.init();
    this.addEvents();
};
ElefundsOneStepCheckoutIntegration.prototype.init = function () {
    this.changePosition();
};
ElefundsOneStepCheckoutIntegration.prototype.addEvents = function () {

};
ElefundsOneStepCheckoutIntegration.prototype.changePosition = function () {
    this.$oneStepMiddleColumn.append('<div class="elefunds"></div>');
    jQuery('.elefunds').append(this.$elefundsModule);
    this.$elefundsModule.parent().fadeIn();
};


/*
 * ++ Change Sum in One-Step-Checkout ++
 */
var ElefundsOneStepCheckoutIntegrationChangeSum = function () {
    this.$roundedSumNode = jQuery('#elefunds_round_sum');
    this.$currencyNode = jQuery('#elefunds_round_sum + strong');

    this.$totalAmountNode = jQuery('.onestepcheckout-totals .grand-total .price');

    this.roundedSum = this.$roundedSumNode.html();

    if (this.$roundedSumNode.length && this.$totalAmountNode.length) {
        this.oldSum = this.$totalAmountNode.html();
        this.isModuleEnabled = false;
        this.addDonationRow();
        this.addEvents();
    }
};

ElefundsOneStepCheckoutIntegrationChangeSum.prototype.addEvents = function () {
    var that = this;

    jQuery(document).on('elefunds_enabled', function () {
        that.isModuleEnabled = true;
        that.activateDonationRow();

        that.changeSumValue();
    });
    jQuery('#elefunds').on('click', function () {
        if (that.isModuleEnabled) {
            that.changeSumValue();
        }
    });
    jQuery('#elefunds_input').on('change', function () {
        if (that.isModuleEnabled) {
            that.changeSumValue();
        }
    });
    jQuery(document).on('elefunds_disabled', function () {
        that.deactivateDonationRow();
        that.isModuleEnabled = false;
        jQuery('.onestepcheckout-totals .grand-total .price').html(that.oldSum);
    });
};
ElefundsOneStepCheckoutIntegrationChangeSum.prototype.changeSumValue = function () {
    if (this.isModuleEnabled) {
        var oldSumReg = this.oldSum.replace(/[^0-9]/gi, '');
        var oldSumValue = parseFloat(oldSumReg / 100);
        var donationValue = parseFloat(jQuery('#elefunds_donation_cent').val() / 100);
        console.log(donationValue);

        this.roundedSum = oldSumValue + donationValue;

        this.$roundedSumNode.html(this.roundedSum.toFixed(2));

        var currency = this.$currencyNode.html();
        jQuery('.onestepcheckout-totals .grand-total .price').html(this.roundedSum.toFixed(2) + ' ' + currency);
        this.updateDonationRow();
    }
};
ElefundsOneStepCheckoutIntegrationChangeSum.prototype.updateSums = function () {
    this.oldSum = jQuery('.onestepcheckout-totals .grand-total .price').html();

    if (!jQuery('.elefunds_donation_row').length) {
        this.addDonationRow();
    }
    if (this.isModuleEnabled) {
        this.activateDonationRow();
    }

    /*
     * New total has to change too
     * As there is the curreny-symbol inside the amount-value we have to remove it
     * (and everything else what is not a number)
     */
    var oldSumReg = this.oldSum.replace(/[^0-9]/gi, '');
    var oldSumValue = parseFloat(oldSumReg / 100);
    var donationValue = parseFloat(jQuery('#elefunds_donation_cent').val() / 100);

    this.roundedSum = oldSumValue + donationValue;

    this.$roundedSumNode.html(this.roundedSum.toFixed(2));
};

/*
 * Adds a new row in order review to show elefunds donation
 * Supply methods for update, activate and remove the row
 */
ElefundsOneStepCheckoutIntegrationChangeSum.prototype.addDonationRow = function () {
    jQuery('' +
        '<tr class="elefunds_donation_row">' +
        '<td class="title">elefunds Donation</td>' +
        '<td class="value">' +
        '<span class="price">' + jQuery('#elefunds_input').val() + '</span>' +
        '</td>' +
        '</tr>' +
        '').insertBefore('.grand-total');
};
ElefundsOneStepCheckoutIntegrationChangeSum.prototype.updateDonationRow = function () {
    var currency = this.$currencyNode.html();
    var donationValue = parseFloat(jQuery('#elefunds_donation_cent').val() / 100);
    jQuery('.elefunds_donation_row .price').html(donationValue.toFixed(2) + ' ' + currency);
};
ElefundsOneStepCheckoutIntegrationChangeSum.prototype.activateDonationRow = function () {
    jQuery('.elefunds_donation_row').addClass('active');
};
ElefundsOneStepCheckoutIntegrationChangeSum.prototype.deactivateDonationRow = function () {
    jQuery('.elefunds_donation_row').removeClass('active');
};


jQuery(document).ready(function () {
    lfndsOneStep.instance = new ElefundsOneStepCheckoutIntegration();
    lfndsOneStep.lfnds_changeSum = new ElefundsOneStepCheckoutIntegrationChangeSum();
});



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
        };

        options['onSuccess'] = callbackProxy;

        $super(url, options);

    }
});
AjaxRequestProxy.Events = Ajax.Request.Events;
Ajax.Request = AjaxRequestProxy;