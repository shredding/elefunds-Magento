<?php
class Knm_Elefunds_Model_Logs extends Mage_Core_Model_Abstract
{
    public function _construct()
    {
        $this->_init('elefunds/logs');
    }

    /*
     *
     * we log all requests to elefunds
     *
     */

    public function logRequest($requestType,$request,$response)
    {
        $this->setRequestType($requestType);
        $this->setRequest($request);
        $this->setResponse($response);
        $this->setCreatedAt(now());
        try
        {
            $this->save();
        }
        catch(Exception $e)
        {
            echo $e->getMessage();
        }
    }
}
