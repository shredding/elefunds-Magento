<?php

class Knm_Elefunds_Model_Mysql4_Receivers_Collection extends Mage_Core_Model_Mysql4_Collection_Abstract
{
    public function _construct()
    {
        $this->_init('elefunds/receivers'); 
    }

    /**
     * Removes receivers by given language.
     *
     * @param string $code
     * @return $this
     */
    public function removeByLanguage($code) {
        $select = $this->getSelect()
                       ->where('countrycode = :code');

        $receivers = $this->_fetchAll($select, array($code));

        /** @var Knm_Elefunds_Model_Receivers $receiver */
        foreach ($receivers as $receiver) {
            $receiver->delete();
        }

        return $this;
    }

    /**
     * Maps an array of receivers (as returned from the SDK) to a doctrine model.
     *
     * @param array $receivers that are implementing Library_Elefunds_Model_ReceiverInterface
     * @param string $languageCode
     *
     * @return $this
     */
    public function mapArrayOfSDKReceiversToEntitiesAndSave(array $receivers, $languageCode) {

        /** @var \Library_Elefunds_Model_ReceiverInterface $receiver */
        foreach ($receivers as $receiver) {
            $entity = new Knm_Elefunds_Model_Receivers();
            $entity->setId($receiver->getId())
                   ->setName($receiver->getName())
                   ->setImage($receiver->getImage('horizontal', 'medium'))
                   ->setValid($receiver->getValidTime())
                   ->setDescription($receiver->getDescription())
                   ->setCountrycode($languageCode)

                   ->save();
        }
        return $this;
    }
}