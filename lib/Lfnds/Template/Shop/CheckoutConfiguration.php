<?php

/**
 * elefunds API PHP Library
 *
 * Copyright (c) 2012 - 2013, elefunds GmbH <hello@elefunds.de>.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 *
 *   * Redistributions of source code must retain the above copyright
 *     notice, this list of conditions and the following disclaimer.
 *
 *   * Redistributions in binary form must reproduce the above copyright
 *     notice, this list of conditions and the following disclaimer in
 *     the documentation and/or other materials provided with the
 *     distribution.
 *
 *   * Neither the name of the elefunds GmbH nor the names of its
 *     contributors may be used to endorse or promote products derived
 *     from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS
 * FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE
 * COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT,
 * INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING,
 * BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT
 * LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN
 * ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 */

namespace Lfnds\Template\Shop;

require_once __DIR__ . '/ShopConfiguration.php';
require_once __DIR__ . '/../../View/BaseView.php';

/**
 * Checkout Configuration for a shop template.
 *
 * @package    elefunds API PHP Library
 * @subpackage Template\Shop
 * @author     Christian Peters <christian@elefunds.de>
 * @copyright  2012 - 2013 elefunds GmbH <hello@elefunds.de>
 * @license    http://www.opensource.org/licenses/BSD-3-Clause  The BSD 3-Clause License
 * @link       http://www.elefunds.de
 * @since      File available since Release 1.0.0
 */
class CheckoutConfiguration extends ShopConfiguration {

    /**
     * Define the checkout variables for the shop template.
     *
     * @return void
     */
    public function init() {

        parent::init();
        $this->view->setRenderFile('Checkout.phtml');

        $this->view->assignMultiple(
            array(
                'clientId'              => $this->getClientId(),
                'countryCode'           => $this->getCountrycode(),
                'view'                  => 'module',
                // If set to FALSE, no donation receipt if offered.
                // If TRUE you have to adjust T&Cs and send back donator information
                // Refer to the documentation for further information.
                'offerDonationReceipt'  => TRUE,
                // Defaults, you can opt to override this if you like.
                'currency'              => '€',
                'currencyDelimiter'     => ','
            )
        );

        // Available theme and color choices
        $this->themes = array('light', 'dark');

        // Chose your theme and color
        $theme = $this->themes[0];
        $color = '#00efa2';

        $this->view->assign('skin',
            array(
                'theme' =>  $theme,
                'color' =>  $color,
                // Receiver logo orientation
                'orientation' => 'horizontal'
            )
        );

        // To implement this template in a shop, you have to add the following
        // (preferably in your own extending class, or via $facade->getConfiguration->getView()->assign()):
        // $this->view->assign('formSelector', '#css .selector .of .form');
        // $this->view->assign('totalSelector', '#css .selector .of .total');
        // $this->view->assign('rowLabel', '#css .selector .of .row .label');
        // $this->view->assign('rowValue', '#css .selector .of .row .value');

    }


    /**
     * Return the available theme choices.
     *
     * @return array
     */
    public function getAvailableThemes() {
        return $this->themes;
    }
}