<?
/*
 * Donation.php
 * 
 * Copyright 2013 Raul Armando Salamanca Gonzalez <raul.salamanca@gmx.de>
 */


class Knm_Elefunds_Model_Donation extends Mage_Core_Model_Abstract
{
    protected $_eventPrefix = 'elefunds_donation';

    /**
     * Donation states
     */
    const
        SCHEDULED_FOR_ADDING          = 0,
        SCHEDULED_FOR_CANCELLATION    = 1,
        SCHEDULED_FOR_VERIFICATION    = 2,
        PENDING                       = 3,
        CANCELLED                     = 4,
        VERIFIED                      = 5;
    
    
    public function loadByAttribute($attribute, $value)
    {
        $this->load($value, $attribute);
        return $this;
    }


    /** Sets all receivers and maps them to a csv for the database.
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
        $this->_init('elefunds/donation');
    }


}
