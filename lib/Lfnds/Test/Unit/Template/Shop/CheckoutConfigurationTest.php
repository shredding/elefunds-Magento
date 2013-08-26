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

namespace Lfnds\Test\Unit\Template\Shop;

use Lfnds\Template\Shop\CheckoutConfiguration;

require_once __DIR__ . '/../../../../Template/Shop/CheckoutConfiguration.php';
require_once __DIR__ . '/../../../../FacadeInterface.php';


/**
 * Unit Test for CheckoutConfiguration.
 *
 * @package    elefunds API PHP Library
 * @subpackage Test
 * @author     Christian Peters <christian@elefunds.de>
 * @copyright  2012 - 2013 elefunds GmbH <hello@elefunds.de>
 * @license    http://www.opensource.org/licenses/BSD-3-Clause  The BSD 3-Clause License
 * @link       http://www.elefunds.de
 * @since      File available since Release 2.0.0
 */
class CheckoutConfigurationTest extends \PHPUnit_Framework_TestCase {


    /**
     * Tests if the correct renderer is set.
     *
     * @test
     */
    public function setsRenderer() {
        $config = new CheckoutConfiguration();
        $config->init();
        $this->assertSame('Checkout.phtml', $config->getView()->getRenderFile());
    }

    /**
     * donationReceiptIsOfferedByDefault
     *
     * @test
     */
    public function donationReceiptIsOfferedByDefault() {

        $config = new CheckoutConfiguration();
        $config->init();

        $assigns = $config->getView()->getAssignments();
        $this->assertTrue($assigns['offerDonationReceipt']);

    }

    /**
     * configurationDefaultOptionsAreAssigned
     *
     * @test
     */
    public function configurationDefaultOptionsAreAssigned() {

        $config = new CheckoutConfiguration();
        $config->init();

        $assigns = $config->getView()->getAssignments();

        $this->assertSame($assigns['currency'], '€');
        $this->assertSame($assigns['currencyDelimiter'], ',');
        $this->assertSame($assigns['skin']['orientation'], 'horizontal');

    }

    /**
     * clientIdAndCountryCodeAreAssigned
     *
     * @test
     */
    public function clientIdViewAndCountryCodeAreAssigned() {
        $config = new CheckoutConfiguration();
        $config->setClientId(1234);
        $config->setCountrycode('de');
        $config->init();

        $assigns = $config->getView()->getAssignments();

        $this->assertSame($assigns['clientId'], 1234);
        $this->assertSame($assigns['countryCode'], 'de');
        $this->assertSame($assigns['view'], 'module');
    }


    /**
     * Tests if the themes are initialized.
     *
     * @test
     */
    public function initializesThemes() {

        $config = new CheckoutConfiguration();
        $config->init();

        $this->assertSame(array('light', 'dark'), $config->getAvailableThemes());

    }

    /**
     * Test: basicThemeIsLightOrange
     *
     * @test
     */
    public function basicThemeIsLightOrange() {
        $config = new CheckoutConfiguration();
        $config->init();

        $theme = $config->getView()->getAssignments()['skin']['theme'];
        $color = $config->getView()->getAssignments()['skin']['color'];

        $this->assertSame('light', $theme);
        $this->assertSame('#00efa2', $color);

    }

}
