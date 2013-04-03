<?php

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
class Lfnds_Donation_Model_Mysql4_Receiver_Collection extends Mage_Core_Model_Mysql4_Collection_Abstract
{
    public function _construct()
    {
        $this->_init('lfnds_donation/receiver');
    }

    /**
     * Removes receivers by given language.
     *
     * @param string $code
     * @return $this
     */
    public function removeByLanguage($code) {

        $receivers = $this->addFieldToFilter('countrycode', $code);
        /** @var Lfnds_Donation_Model_Receiver $receiver */
        foreach ($receivers as $receiver) {
            $receiver->delete();
        }

        return $this->_reset();
    }

    /**
     * Maps an array of receivers (as returned from the SDK) to a doctrine model.
     *
     * @param array $receivers that are implementing Elefunds_Model_ReceiverInterface
     * @param string $languageCode
     *
     * @return $this
     */
    public function mapArrayOfSDKReceiversToEntitiesAndSave(array $receivers, $languageCode) {

        /** @var Elefunds_Model_ReceiverInterface $receiver */
        foreach ($receivers as $receiver) {
            /** @var Lfnds_Donation_Model_Receiver $entity  */
            $entity = Mage::getModel('lfnds_donation/receiver');
            $entity->setReceiverId($receiver->getId())
                   ->setName($receiver->getName())
                   ->setImage($receiver->getImage('horizontal', 'medium'))
                   ->setValid($receiver->getValidTime())
                   ->setDescription($receiver->getDescription())
                   ->setCountrycode($languageCode);

            try {
                $entity->save();
            } catch (Exception $exception) {
                Mage::logException($exception);
            }
        }
        return $this;
    }
}