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
 *
 */

namespace Lfnds\Template\Shop\Helper;

/**
 * Helper for request verification.
 *
 * @package    elefunds API PHP Library
 * @subpackage Template\Shop
 * @author     Christian Peters <christian@elefunds.de>
 * @copyright  2012 - 2013 elefunds GmbH <hello@elefunds.de>
 * @license    http://www.opensource.org/licenses/BSD-3-Clause  The BSD 3-Clause License
 * @link       http://www.elefunds.de
 * @since      File available since Release 1.2.1
 */

class RequestHelper {

    protected $request;

    /**
     * @var array
     */
    protected $receivers;

    /**
     * Accepts the request as array.
     *
     * However, it's recommended to not pass an request, the helper will then use (and NOT alter) the $_POST
     * superglobal.
     *
     * @param array $request
     */
    public function __construct(array $request = NULL) {
        if (is_null($request)) {
            $this->request = $_POST;
        } else {
            $this->request = $request;
        }
    }

    /**
     * Checks if the given request contains the basic information for the elefunds module and checks
     * if the module is active. The module is active and valid if the following parameters are set:
     *
     * elefunds_agree: if the module is checked
     * elefunds_donation_cent: the donation amount in cent
     * elefunds_receivers[]: list of receivers the donation goes to
     * elefunds_receivers: alternative - comma separated list of receivers as a string (in case the value is read from a hidden field)
     *
     * @return bool
     */
    public function isActiveAndValid() {

        $agreedToElefunds = isset($this->request['elefunds_agree']) && $this->request['elefunds_agree'] !== 'false';
        $hasDonation = $this->isConvertableToPositiveInt('elefunds_donation_cent');
        $hasValidReceivers = count($this->validatedReceivers()) > 0;

        return $agreedToElefunds && $hasDonation && $hasValidReceivers;
    }

    /**
     * Returns the roundup of the request.
     *
     * @return int
     */
    public function getRoundUp() {
        return (int)$this->request['elefunds_donation_cent'];
    }

    /**
     * Returns the roundup as floated string (two decimal)
     *
     * @return string
     */
    public function getRoundUpAsFloatedString() {
        return number_format($this->getRoundUp() / 100, 2);
    }

    /**
     * Returns the receivers id's of the request, mapped to int and validated!
     *
     * @return array
     */
    public function getReceiverIds() {
        return $this->receivers;
    }

    /**
     * Returns the receivers that were available during the checkout.
     *
     * @return array
     */
    public function getAvailableReceiverIds() {
        return $this->validatedReceivers(TRUE);
    }

    /**
     * Returns the receivers as comma separated string (WWF, Ärzte ohne Grenzen, SOS Kinderdörfer).
     *
     * This method should not break things, as the module works internally with ids. However, if you need them for
     * informational purposes, they are available here.
     *
     * If the receivers are not available for some reason, an empty string is returned.
     *
     * @return string
     */
    public function getReceiversAsString() {
        $receiversAsString = '';
        if (!isset($this->request['elefunds_receiver_names'])) {
            return $receiversAsString;
        }

        if (is_array($this->request['elefunds_receiver_names'])) {
            $receiversAsString = implode(', ', $this->request['elefunds_receiver_names']);
        } else {
            // We have to add a space, that's why we have to remap the values:
            $receiversAsString = implode(', ', explode(',', $this->request['elefunds_receiver_names']));
        }

        return $receiversAsString;
    }

    /**
     * Returns the suggested roundup in Cent as integer.
     *
     * @return int
     */
    public function getSuggestedRoundUp() {
        if ($this->isConvertableToPositiveInt('elefunds_suggested_round_up_cent')) {
            return (int)$this->request['elefunds_suggested_round_up_cent'];
        }
        return 0;
    }

    /**
     * Returns true if the customer requested a donation receipt.
     *
     * @return bool
     */
    public function isDonationReceiptRequested() {
        return isset($this->request['elefunds_receipt']) && $this->request['elefunds_receipt'] !== 'false';
    }

    /**
     * Returns true if the requestKey is positive.
     *
     * @param string $requestKey
     * @return bool
     */
    protected function isConvertableToPositiveInt($requestKey) {

        if (!isset($this->request[$requestKey])) {
            return FALSE;
        }

        if (is_int($this->request[$requestKey])) {
            $isInt = TRUE;
        } else {
            $isInt = ctype_digit($this->request[$requestKey]);
        }

        return $isInt && (int)$this->request[$requestKey] > 0;

    }

    /**
     * Returns the receivers id's of the request, mapped to int and validated and assigns them
     * to $this->receivers.
     *
     * The returned array is empty if not exist or if not all receivers are valid. We're very strict here,
     * if a part of the array does not match, we invalidate the entire request.
     *
     * If you set validateAvailable to TRUE, the elefunds_available_receivers is validated.
     *
     * @param bool $validateAvailable
     * @return array
     */
    protected function validatedReceivers($validateAvailable = FALSE) {

        $receivers = $validateAvailable ? 'elefunds_available_receivers' : 'elefunds_receivers';
        if (!isset($this->request[$receivers])) {
            return array();
        }

        if (is_array($this->request[$receivers])) {
            $integerIds = array_map(function($x) { return (int)$x; }, $this->request[$receivers]);
        } else {
            $integerIds = array_map(function($x) { return (int)$x; }, explode(',', $this->request[$receivers]));
        }

        $filtered = array_unique(array_filter($integerIds, function($x) { return $x > 0; }));
        if (count($filtered) !== count($integerIds)) {
            return array();
        };

        $this->receivers = $filtered;
        return $filtered;
    }

}