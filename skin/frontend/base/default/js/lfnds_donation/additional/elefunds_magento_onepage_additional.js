/*
 * When Module is placed on bottom (above Checkout-Button)
 */
var lfndsModule = function () {
    // if #checkout-review-table-wrapper + #elefunds-form
    this.$elefunds = jQuery('#elefunds');
    this.$elefundsBelow = jQuery('#elefunds_below_container');

    this.currency = '€';

    this.addEvents();
};
lfndsModule.prototype.addEvents = function () {
    var me = this;

    jQuery(document).on('elefunds_enabled', function (event) {
        if (jQuery('#checkout-review-table-wrapper + #elefunds-form').length) {

            jQuery('#elefunds_below_container').slideDown(function () {
                jQuery('#elefunds_below_container').removeClass('elefunds_hidden');
                jQuery('#elefunds_round_sum_container').removeClass('elefunds_hidden');
            });

        }
    });

    jQuery(document).on('elefunds_disabled', function (event) {
        if (jQuery('#checkout-review-table-wrapper + #elefunds-form').length) {

            jQuery('#elefunds_below_container').slideUp(function () {
                jQuery('#elefunds_below_container').addClass('elefunds_hidden');
                jQuery('#elefunds_round_sum_container').addClass('elefunds_hidden');
            });

        }
    });
};


/*
 * When Module is placed on top (above article-review)
 */
var lfndsModuleTop = function () {
    this.isDonationRowCreated = false;
    this.isOldPriceSaved = false;
    this.isModuleActive = false;
    this.currency = '€';
    this.addEvents();
};
lfndsModuleTop.prototype.addEvents = function () {
    var me = this;

    jQuery(document).on('elefunds_enabled', function (event) {
        if (!jQuery('#checkout-review-table-wrapper + #elefunds-form').length) {

            me.isModuleActive = true;

            if (!me.isOldPriceSaved) {
                me.oldPrice = jQuery('#checkout-review-table tfoot tr.last .price').html();
                me.isOldPriceSaved = true;
            }

            jQuery('#checkout-review-table tfoot tr.last .price').html(jQuery('#elefunds_round_sum').html() + ' ' + me.currency);

            jQuery('#elefunds_below_container').slideDown(function () {
                jQuery('#elefunds_below_container').removeClass('elefunds_hidden');
            });

            if (!jQuery('#donationRow').length) {
                me.createDonationRow();
            } else {
                me.showDonationRow();
            }


            /*
             * Events can only be registered when Module is already shown,
             * so register events when activating module for the first time.
             */
            jQuery('#elefunds_input').on('change', function () {
                if (me.isModuleActive) {
                    jQuery('#checkout-review-table tfoot tr.last .price').html(jQuery('#elefunds_round_sum').html() + ' ' + me.currency);
                }
                me.updateDonationRow();
            });
            jQuery('#elefunds_plus_minus').on('click', function () {
                jQuery('#elefunds_input').trigger('change');
            });
            jQuery('#elefunds_input').on('keypress', function () {
                jQuery('#elefunds_input').trigger('change');
            });

        }
    });

    jQuery(document).on('elefunds_disabled', function (event) {
        if (!jQuery('#checkout-review-table-wrapper + #elefunds-form').length) {

            me.isModuleActive = false;

            jQuery('#elefunds_below_container').slideUp(function () {
                jQuery('#checkout-review-table tfoot tr.last .price').html(me.oldPrice);
                jQuery('#elefunds_below_container').addClass('elefunds_hidden');
                jQuery('#elefunds_round_sum_container').addClass('elefunds_hidden');
            });

            me.hideDonationRow();
        }
    });
};
lfndsModuleTop.prototype.createDonationRow = function () {
    var donationValue = parseFloat(jQuery('#elefunds_donation_cent').val() / 100);

    jQuery('' +
        '<tr id="donationRow">' +
            '<td class="a-right" colspan="3">' +
                'elefunds Donation' +
            '</td>' +
            '<td class="a-right">' +
                '<span class="price">' +
                    donationValue.toFixed(2) + ' ' + this.currency +
                '</span>' +
            '</td>' +
        '</tr>' +
        '').insertBefore('#checkout-review-table tfoot tr.last');

    this.isDonationRowCreated = true;
};
lfndsModuleTop.prototype.showDonationRow = function () {
    jQuery('#donationRow').show();
};
lfndsModuleTop.prototype.hideDonationRow = function () {
    jQuery('#donationRow').hide();
};
lfndsModuleTop.prototype.updateDonationRow = function () {
    var donationValue = parseFloat(jQuery('#elefunds_donation_cent').val() / 100);

    jQuery('#donationRow .price').html('' +
        donationValue.toFixed(2)  + ' ' + this.currency +
    '');
};


jQuery(document).ready(function () {
    var lfnds = new lfndsModuleTop();
    var lfndsBottom = new lfndsModule();
});