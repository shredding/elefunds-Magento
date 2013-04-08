/*
 * ++ One Step Checkout Specific JavaScript ++
 */

var ElefundsOneStepCheckoutIntegration = function () {
    /*
     * Cache important DOM-Nodes as member-variables
     */
    this.$oneStepMiddleColumn = jQuery('.onestepcheckout-column-middle');
    this.$elefundsModule = jQuery('.elefunds');

    this.init();
    this.addEvents();
};
ElefundsOneStepCheckoutIntegration.prototype.init = function () {
    this.changePosition();
};
ElefundsOneStepCheckoutIntegration.prototype.addEvents = function () {

};
ElefundsOneStepCheckoutIntegration.prototype.changePosition = function () {
    this.$oneStepMiddleColumn.append(this.$elefundsModule);
    this.$elefundsModule.fadeIn();
};


/*
 * ++ Change Sum in One-Step-Checkout ++
 */

var ElefundsOneStepCheckoutIntegrationChangeSum = function () {
    console.log(OneStepCheckoutLoginPopup);

    this.$roundedSumNode = jQuery('#elefunds_round_sum');
    this.$currencyNode = jQuery('#elefunds_round_sum + strong');
    this.$totalAmountNode = jQuery('.onestepcheckout-totals .grand-total .price');

    if (this.$roundedSumNode.length && this.$totalAmountNode.length) {
        this.oldSum = this.$totalAmountNode.html();
        this.isModuleEnabled = false;
        this.addEvents();
    }
};

ElefundsOneStepCheckoutIntegrationChangeSum.prototype.addEvents = function () {
    var that = this;

    jQuery(document).on('elefunds_enabled', function () {
        that.isModuleEnabled = true;

        that.changeSumValue();
    });
    jQuery('#elefunds').on('click', function () {
        if (that.isModuleEnabled) {
            that.changeSumValue();
        }
    });
    jQuery(document).on('elefunds_disabled', function () {
        that.isModuleEnabled = false;
        jQuery('.onestepcheckout-totals .grand-total .price').html(that.oldSum);
    });
};
ElefundsOneStepCheckoutIntegrationChangeSum.prototype.changeSumValue = function () {
    var roundedSum = this.$roundedSumNode.html(),
        currency = this.$currencyNode.html();
    jQuery('.onestepcheckout-totals .grand-total .price').html(roundedSum + ' ' + currency);
};



jQuery(document).ready(function () {
    var instance = new ElefundsOneStepCheckoutIntegration(),
        lfnds_changeSum = new ElefundsOneStepCheckoutIntegrationChangeSum();
});