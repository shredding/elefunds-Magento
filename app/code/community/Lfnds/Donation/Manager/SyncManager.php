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
 * Syncs between database and API.
 *
 * @package    elefunds Magento Module
 * @subpackage Manager
 * @author     Christian Peters <christian@elefunds.de>
 * @copyright  2012 elefunds GmbH <hello@elefunds.de>
 * @license    http://www.opensource.org/licenses/BSD-3-Clause  The BSD 3-Clause License
 * @link       http://www.elefunds.de
 * @since      File available since Release 1.0.0
 */
class Lfnds_Donation_Manager_SyncManager
{

    /**
     * @var Elefunds_Facade
     */
    protected $facade;

    /**
     * Initialisation of the sync process.
     *
     * @param Elefunds_Facade $facade
     */
    public function __construct(Elefunds_Facade $facade) {
        $this->facade = $facade;
    }

    /**
     * Retrieves fresh sets of receivers.
     *
     * The sync is done for the german and english language. For convenience,
     * the receivers of the current magento locale are returned.
     *
     * @return array with receivers of the facade's original countrycode
     */
    public function syncReceivers() {

        /** @var Lfnds_Donation_Model_Mysql4_Receiver_Collection $receiverCollection  */
        $receiverCollection = Mage::getModel('lfnds_donation/receiver')->getCollection();

        // We want this to be available from anywhere, so we do not set state!
        $originalCountryCode = $this->facade->getConfiguration()->getCountrycode();

        $returnedReceivers = array();
        $germanReceivers = array();
        $englishReceivers = array();

        try {
            $this->facade->getConfiguration()->setCountrycode('de');
            $germanReceivers = $this->facade->getReceivers();

            $this->facade->getConfiguration()->setCountrycode('en');
            $englishReceivers = $this->facade->getReceivers();

        } catch (Elefunds_Exception_ElefundsCommunicationException $exception) {
            // Pass, we still use the old receivers.
        }

        if (count($germanReceivers) > 0) {
            $receiverCollection->removeByLanguage('de')
                               ->mapArrayOfSDKReceiversToEntitiesAndSave($germanReceivers, 'de');
        }

        if (count($englishReceivers) > 0) {
            $receiverCollection->removeByLanguage('en')
                               ->mapArrayOfSDKReceiversToEntitiesAndSave($englishReceivers, 'en');
        }

        if ($originalCountryCode === 'de') {
            $returnedReceivers = $germanReceivers;
        }

        if ($originalCountryCode === 'en') {
            $returnedReceivers = $englishReceivers;
        }

        $this->facade->getConfiguration()->setCountrycode($originalCountryCode);

        return $returnedReceivers;
    }

    /**
     * Syncs all donations to the API.
     *
     * @return $this
     */
    public function syncDonations() {

        /** @var Lfnds_Donation_Model_Mysql4_Donation_Collection $donationCollection  */
        $donationCollection = Mage::getModel('lfnds_donation/donation')->getCollection();
        $donationCollection->addFieldToFilter('state',
            array(
                Lfnds_Donation_Model_Donation::SCHEDULED_FOR_ADDING,
                Lfnds_Donation_Model_Donation::SCHEDULED_FOR_CANCELLATION,
                Lfnds_Donation_Model_Donation::SCHEDULED_FOR_COMPLETION
            )
        );

        $donationsToBeCancelled = array();
        $donationsToBeCompleted = array();
        $donationsToBeAdded = array();

        /** @var Lfnds_Donation_Model_Donation $donationModel */
        foreach ($donationCollection as $donationModel) {
            switch ($donationModel->getState()) {

                case Lfnds_Donation_Model_Donation::SCHEDULED_FOR_ADDING:
                    $donationsToBeAdded[$donationModel->getForeignId()] = $donationModel;
                    break;

                case Lfnds_Donation_Model_Donation::SCHEDULED_FOR_CANCELLATION:
                    $donationsToBeCancelled[$donationModel->getForeignId()] = $donationModel;
                    break;

                case Lfnds_Donation_Model_Donation::SCHEDULED_FOR_COMPLETION:
                    $donationsToBeCompleted[$donationModel->getForeignId()] = $donationModel;
                    break;
            }
        }

        // Add pending donations
        try {
            $this->facade->addDonations($this->mapArrayOfEntitiesToSDKObject($donationsToBeAdded));
            $donationCollection->setStates($donationsToBeAdded, Lfnds_Donation_Model_Donation::PENDING);
        } catch (Elefunds_Exception_ElefundsCommunicationException $exception) {
            $donationCollection->setStates($donationsToBeAdded, Lfnds_Donation_Model_Donation::SCHEDULED_FOR_ADDING);
        }

        // Cancel donations
        try {
            $this->facade->cancelDonations(array_keys($donationsToBeCancelled));
            $donationCollection->setStates($donationsToBeCancelled, Lfnds_Donation_Model_Donation::CANCELLED);
        } catch (Elefunds_Exception_ElefundsCommunicationException $exception) {
            $donationCollection->setStates($donationsToBeCancelled, Lfnds_Donation_Model_Donation::SCHEDULED_FOR_CANCELLATION);
        }

        // Complete donation
         try {
            $this->facade->completeDonations(array_keys($donationsToBeCompleted));
             $donationCollection->setStates($donationsToBeCompleted, Lfnds_Donation_Model_Donation::COMPLETED);
        } catch (Elefunds_Exception_ElefundsCommunicationException $exception) {
             $donationCollection->setStates($donationsToBeCompleted, Lfnds_Donation_Model_Donation::SCHEDULED_FOR_COMPLETION);
        }

        return $this;
    }

    /**
     * Maps an array of Donation entities to SDK Objects.
     *
     * @param array
     * @return array
     */
    protected function mapArrayOfEntitiesToSDKObject(array $donationModels) {

        $sdkDonations = array();

        /** @var Donation $donationModel */
        foreach ($donationModels as $donationModel) {

            $donation = $this->facade->createDonation()
                ->setForeignId($donationModel->getForeignId())
                ->setAmount($donationModel->getAmount())
                ->setSuggestedAmount($donationModel->getSuggestedAmount())
                ->setGrandTotal($donationModel->getGrandTotal())
                ->setReceiverIds($donationModel->getReceiverIds())
                ->setAvailableReceiverIds($donationModel->getAvailableReceiverIds())
                ->setTime($donationModel->getTime());

            try {
                $donation->setDonator(
                    $donationModel->getDonatorEmail(),
                    $donationModel->getDonatorFirstName(),
                    $donationModel->getDonatorLastName(),
                    $donationModel->getDonatorStreetAddress(),
                    $donationModel->getDonatorZip(),
                    $donationModel->getDonatorCity(),
                    $donationModel->getDonatorCountrycode()
                );
            } catch(InvalidArgumentException $exception) {
                // It's always easier to ask for forgiveness, than for permission.
            }

            $sdkDonations[] = $donation;
        }

        return $sdkDonations;
    }
}