<?php

class Knm_Elefunds_Model_Mysql4_Donation_Collection extends Mage_Core_Model_Mysql4_Collection_Abstract
{
    public function _construct()
    {
        $this->_init('elefunds/donation'); 
    }

    /**
     * Receives all donations that have a potential for syncing.
     *
     * @return array of donations
     */
    public function findSyncables() {

        $select = $this->getSelect()
            ->where('state = :scheduledForAdding')
            ->orWhere('state = :scheduledForCancellation')
            ->orWhere('state = :scheduledForVerification');

        return $this->_fetchAll($select,
            array(
                'scheduledForAdding'          =>  Knm_Elefunds_Model_Donation::SCHEDULED_FOR_ADDING,
                'scheduledForCancellation'    =>  Knm_Elefunds_Model_Donation::SCHEDULED_FOR_CANCELLATION,
                'scheduledForVerification'    =>  Knm_Elefunds_Model_Donation::SCHEDULED_FOR_VERIFICATION,
            )
        );
    }

    /**
     * Sets given donations as synced and flushes the
     * entity manager.
     *
     * @param array $donations
     * @param int $state
     * @return void
     */
    public function setStates(array $donations, $state) {
        foreach ($donations as $donation) {
            /** @var Knm_Elefunds_Model_Donation $donation */
            $donation->setState($state);
            $donation->save();
        }
    }

    /**
     * Adds a donation to the repository.
     *
     * @param string $foreignId
     *
     * @param int $roundup
     * @param int $grandTotal
     * @param array $receivers
     * @param array $availableReceivers
     * @param array $userData
     * @param string $languageCode
     * @param int $suggestedRoundUp
     * @return void
     */
    public function addDonation($foreignId, $roundup, $grandTotal, array $receivers, $availableReceivers, $userData, $languageCode, $suggestedRoundUp = 0) {
        $donation = new Knm_Elefunds_Model_Donation();
        $donation->setForeignId($foreignId)
            ->setAmount((int)$roundup)
            ->setGrandTotal((int)$grandTotal)
            ->setReceiverIds($receivers)
            ->setAvailableReceiverIds($availableReceivers)
            ->setTime(new \DateTime())
            ->setSuggestedAmount((int)$suggestedRoundUp);

        foreach ($userData as $key => $value) {
            call_user_func(array($donation, 'setDonator' . ucfirst($key)), $value);
        }
        if (count($userData) > 0) {
            $donation->setDonatorCountrycode($languageCode);
        }

        $donation->save();

    }
}
