<?
/**
 * elefunds Magento Module
 *
 * Copyright (c) 2012, elefunds GmbH <hello@elefunds.de>.
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

/**
 * General helper function to access and configure the SDK in magento
 *
 * @package    elefunds Magento Module
 * @subpackage Model
 * @author     Raul Armando Salamanca Gonzalez <raul.salamanca@gmx.de>, Christian Peters <christian@elefunds.de>
 * @copyright  2012 elefunds GmbH <hello@elefunds.de>
 * @license    http://www.opensource.org/licenses/BSD-3-Clause  The BSD 3-Clause License
 * @link       http://www.elefunds.de
 * @since      File available since Release 1.0.0
 */
class Lfnds_Donation_Model_Donation extends Mage_Core_Model_Abstract
{

    protected $_eventPrefix = 'elefunds_donation';

    /**
     * Donation states
     */
    const
        NEW_ORDER                     =  0,
        SCHEDULED_FOR_ADDING          =  1,
        SCHEDULED_FOR_CANCELLATION    =  2,
        SCHEDULED_FOR_COMPLETION      =  3,
        PENDING                       =  4,
        CANCELLED                     =  5,
        COMPLETED                     =  6;

    const ELEFUNDS_VIRTUAL_PRODUCT_SKU = 'elefunds-donation';

    public function loadByAttribute($attribute, $value)
    {
        $this->load($value, $attribute);
        return $this;
    }

    /**
     * Timestamp wrapper for time.
     *
     * @param DateTime $time
     * @return $this
     */
    public function setTime(DateTime $time) {
        parent::setTime($time->format('Y-m-d H:i:s'));
        return $this;
    }

    /**
     * Timestamp wrapper for time.
     *
     * @return DateTime
     */
    public function getTime() {
        return Datetime::createFromFormat('Y-m-d H:i:s', parent::getTime(), new DateTimeZone('UTC'));
    }

    /**
     * Sets all receivers and maps them to a csv for the database.
     *
     * @param array $receiverIds
     * @return $this
     */
    public function setReceiverIds(array $receiverIds) {
        parent::setReceiverIds(implode(',', $receiverIds));
        return $this;
    }

    /**
     * Maps back the csv to an array of receiver ids as int and
     * returns it.
     *
     * @return array
     */
    public function getReceiverIds() {
        return array_map(function($x) { return (int)$x;}, explode(',',parent::getReceiverIds()));
    }

    /**
     * Sets the available receivers, that are saved as CSV in
     * the database.
     *
     * @param array $availableReceiverIds
     * @return $this
     */
    public function setAvailableReceiverIds($availableReceiverIds) {
        parent::setAvailableReceiverIds(implode(',', $availableReceiverIds));
        return $this;
    }

    /**
     * Returns the CSV from the database mapped to an array of integers and returns it.
     *
     * @return array
     */
    public function getAvailableReceiverIds() {
        return array_map(function($x) { return (int)$x;}, explode(',',parent::getAvailableReceiverIds()));
    }


    protected function _construct()
    {
        $this->_init('lfnds_donation/donation');
    }


}
