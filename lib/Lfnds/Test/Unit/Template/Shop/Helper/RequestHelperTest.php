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

namespace Lfnds\Test\Unit\Template\Shop\Helper;
use Lfnds\Template\Shop\Helper\RequestHelper;
use ReflectionClass;

require_once __DIR__ . '/../../../../../Template/Shop/Helper/RequestHelper.php';


/**
 * Unit Test for RequestHelper.
 *
 * @package    elefunds API PHP Library
 * @subpackage Test
 * @author     Christian Peters <christian@elefunds.de>
 * @copyright  2012 - 2013 elefunds GmbH <hello@elefunds.de>
 * @license    http://www.opensource.org/licenses/BSD-3-Clause  The BSD 3-Clause License
 * @link       http://www.elefunds.de
 * @since      File available since Release 2.0.0
 */
class RequestHelperTest extends \PHPUnit_Framework_TestCase {

    /**
     * missingRequestWillFallbackToPostSuperglobal
     *
     * @test
     */
    public function missingRequestWillFallbackToPostSuperglobal() {
        $_POST['addedValue'] = TRUE;
        $helper = new RequestHelper();

        $reflectionClass = new ReflectionClass('Lfnds\Template\Shop\Helper\RequestHelper');

        $reflectionProperty = $reflectionClass->getProperty('request');
        $reflectionProperty->setAccessible(TRUE);
        $request = $reflectionProperty->getValue($helper);

        $this->assertSame(TRUE, isset($request['addedValue']));
        $this->assertSame(TRUE, $request['addedValue']);

    }

    /**
     * agreedToElefundsAGivenDonationAndValidReceiversLeadsToActiveAndValidRequest
     *
     * @test
     */
    public function agreedToElefundsAGivenDonationAndValidReceiversLeadsToActiveAndValidRequest() {

        $request = [
            'elefunds_agree'            => 'true',
            'elefunds_donation_cent'    => '100',
            'elefunds_receivers'        => [1,2,3]

        ];

        $helper = new RequestHelper($request);

        $this->assertTrue($helper->isActiveAndValid());

        // Test with int as donation:
        $request['elefunds_donation_cent'] = 100;
        $helper = new RequestHelper($request);
        $this->assertTrue($helper->isActiveAndValid());
    }

    /**
     * failsIfReceiversAreGivenAsCSV
     *
     * @test
     */
    public function receiverCanBeGivenAsCSV() {
        // Test with csv as receivers:
        $request = [
            'elefunds_agree'            => 'true',
            'elefunds_donation_cent'    => '100',
            'elefunds_receivers'        => '1,2,3'

        ];
        $helper = new RequestHelper($request);
        $this->assertTrue($helper->isActiveAndValid());

    }

    /**
     * isActiveAndValidRequestFailsIfAgreementIsFalse
     *
     * @test
     */
    public function isActiveAndValidRequestFailsIfAgreementIsFalse() {
        $request = [
            'elefunds_agree'            => 'false',
            'elefunds_donation_cent'    => '100',
            'elefunds_receivers'        => [1,2,3]

        ];

        $helper = new RequestHelper($request);
        $this->assertFalse($helper->isActiveAndValid());
    }

    /**
     * isActiveAndValidRequestFailsIfDonationIsNotConvertableToPositiveInt
     *
     * @test
     */
    public function isActiveAndValidRequestFailsIfDonationIsNotConvertableToPositiveInt() {
        $request = [
            'elefunds_agree'            => 'true',
            'elefunds_donation_cent'    => '-110',
            'elefunds_receivers'        => [1,2,3]

        ];

        $helper = new RequestHelper($request);
        $this->assertFalse($helper->isActiveAndValid());

        $request['elefunds_donation_cent'] = '0';
        $helper = new RequestHelper($request);
        $this->assertFalse($helper->isActiveAndValid());

        $request['elefunds_donation_cent'] = array();
        $helper = new RequestHelper($request);
        $this->assertFalse($helper->isActiveAndValid());

    }

    /**
     * isActiveAndValidRequestFailsIfElefundsReceiversIsNotAnArrayOfPositiveInts
     *
     * @test
     */
    public function isActiveAndValidRequestFailsIfElefundsReceiversIsNotAnArrayOfPositiveInts() {
        $request = [
            'elefunds_agree'            => 'true',
            'elefunds_donation_cent'    => '100',
            'elefunds_receivers'        => [-1,2,3]

        ];

        $helper = new RequestHelper($request);
        $this->assertFalse($helper->isActiveAndValid());

        $request['elefunds_receivers'] = '0,2,3';
        $helper = new RequestHelper($request);
        $this->assertFalse($helper->isActiveAndValid());

        $request['elefunds_receivers'] = array(4, 'Not a number');
        $helper = new RequestHelper($request);
        $this->assertFalse($helper->isActiveAndValid());
    }

    /**
     * isActiveAndValidRequestFailsIfElefundsReceiversIsNotAnArrayOfPositiveInts
     *
     * @test
     */
    public function isActiveAndValidRequestFailsIfElefundsReceiversIsDoubled() {
        $request = [
            'elefunds_agree'            => 'true',
            'elefunds_donation_cent'    => '100',
            'elefunds_receivers'        => [1,1,3]

        ];

        $helper = new RequestHelper($request);
        $this->assertFalse($helper->isActiveAndValid());
    }

    /**
     * getAvailableReceiversReturnsAllAvailableReceivers
     *
     * @test
     */
    public function getAvailableReceiversReturnsAllAvailableReceivers() {
        $helper = new RequestHelper(array('elefunds_available_receivers' => '1,2,3'));
        $this->assertSame(array(1,2,3), $helper->getAvailableReceiverIds());

        // Array should be possible as well
        $helper = new RequestHelper(array('elefunds_available_receivers' => [1,2,3]));
        $this->assertSame(array(1,2,3), $helper->getAvailableReceiverIds());
    }

    /**
     * getAvailableReceiversReturnsEmptyArrayIfValidationFails
     *
     * @test
     */
    public function getAvailableReceiversReturnsEmptyArrayIfValidationFails() {
        $helper = new RequestHelper(array('elefunds_available_receivers' => '1,fail,2'));
        $this->assertEmpty($helper->getAvailableReceiverIds());

        $helper = new RequestHelper(array('elefunds_available_receivers' => [1, -1, 2]));
        $this->assertEmpty($helper->getAvailableReceiverIds());

        $helper = new RequestHelper(array('elefunds_available_receivers' => [1, 1, 2]));
        $this->assertEmpty($helper->getAvailableReceiverIds());

        $helper = new RequestHelper(array('elefunds_available_receivers' => NULL));
        $this->assertEmpty($helper->getAvailableReceiverIds());

        $helper = new RequestHelper(array());
        $this->assertEmpty($helper->getAvailableReceiverIds());
    }

    /**
     * getReceiversAsStringReturnsEmptyStringIfReceiverStringsAreNotSet
     *
     * @test
     */
    public function getReceiversAsStringReturnsEmptyStringIfReceiverStringsAreNotSet() {
        $helper = new RequestHelper(array());
        $this->assertSame('', $helper->getReceiversAsString());
    }

    /**
     * getReceiversAsStringAcceptsCSVValues
     *
     * @test
     */
    public function getReceiversAsStringAcceptsCSVValues() {
        $helper = new RequestHelper(array('elefunds_receiver_names' => 'a,b,c'));
        $this->assertSame('a, b, c', $helper->getReceiversAsString());
    }

    /**
     * getReceiversAsStringReturnsCSV
     *
     * @test
     */
    public function getReceiversAsStringReturnsCSV() {
        $helper = new RequestHelper(array('elefunds_receiver_names' => array('a', 'b', 'c')));
        $this->assertSame('a, b, c', $helper->getReceiversAsString());
    }

    /**
     * Test: getRoundupMapsToInt
     *
     * @test
     */
    public function getRoundupMapsToInt() {
        $helper = new RequestHelper(['elefunds_donation_cent'    => '100']);
        $this->assertSame(100, $helper->getRoundUp());
    }

    /**
     * getRoundupAsFloatDoesAValidRounding
     *
     * @test
     */
    public function getRoundupAsFloatDoesAValidRounding() {
        $helper = new RequestHelper(['elefunds_donation_cent'    => '100']);
        $this->assertSame('1.00', $helper->getRoundUpAsFloatedString());

        $helper = new RequestHelper(['elefunds_donation_cent'    => '13294']);
        $this->assertSame('132.94', $helper->getRoundUpAsFloatedString());

        $helper = new RequestHelper(['elefunds_donation_cent'    => '32']);
        $this->assertSame('0.32', $helper->getRoundUpAsFloatedString());

    }

    /**
     * suggestedRoundUpIsConvertedToInt
     *
     * @test
     */
    public function suggestedRoundUpIsConvertedToInt() {
        $helper = new RequestHelper(['elefunds_suggested_round_up_cent' => '100']);
        $this->assertSame(100, $helper->getSuggestedRoundUp());
    }

    /**
     * suggestedRoundUpReturnsZeroIfIsNotConvertableToPositiveInt
     *
     * @test
     */
    public function suggestedRoundUpReturnsZeroIfIsNotConvertableToPositiveInt() {
        $helper = new RequestHelper(['elefunds_suggested_round_up_cent' => '-100']);
        $this->assertSame(0, $helper->getSuggestedRoundUp());
        $helper = new RequestHelper(['elefunds_suggested_round_up_cent' => 'NAN']);
        $this->assertSame(0, $helper->getSuggestedRoundUp());

        $helper = new RequestHelper(['elefunds_suggested_round_up_cent' => 0]);
        $this->assertSame(0, $helper->getSuggestedRoundUp());

        $helper = new RequestHelper(['elefunds_suggested_round_up_cent' => array()]);
        $this->assertSame(0, $helper->getSuggestedRoundUp());
    }

    /**
     * isDonationReceiptRequestedReturnsTrueIfKeyIsNotFalse
     *
     * @test
     */
    public function isDonationReceiptRequestedReturnsTrueIfKeyIsNotFalse() {
        $helper = new RequestHelper(['elefunds_receipt' => 'true']);
        $this->assertTrue($helper->isDonationReceiptRequested());
    }

    /**
     * isDonationReceiptRequestedReturnsFalsefKeyIsFalseOrNotSet
     *
     * @test
     */
    public function isDonationReceiptRequestedReturnsFalsefKeyIsFalseOrNotSet() {
        $helper = new RequestHelper(['elefunds_receipt' => 'false']);
        $this->assertFalse($helper->isDonationReceiptRequested());
        $helper = new RequestHelper(array());
        $this->assertFalse($helper->isDonationReceiptRequested());
    }
}
