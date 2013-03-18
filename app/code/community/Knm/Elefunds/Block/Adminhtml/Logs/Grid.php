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
 * @subpackage Block
 * @author     Raul Armando Salamanca Gonzalez <raul.salamanca@gmx.de>, Christian Peters <christian@elefunds.de>
 * @copyright  2012 elefunds GmbH <hello@elefunds.de>
 * @license    http://www.opensource.org/licenses/BSD-3-Clause  The BSD 3-Clause License
 * @link       http://www.elefunds.de
 * @since      File available since Release 1.0.0
 */
class Knm_Elefunds_Block_Adminhtml_Logs_Grid extends Mage_Adminhtml_Block_Widget_Grid {

    // @todo analyze this
    public function __construct() {
        parent::__construct();
        $this->setId('ElefundsLogsGrid');
        $this->setDefaultSort('position');
        $this->setDefaultDir('ASC');
        $this->setSaveParametersInSession(true);
    }

    protected function _prepareCollection() {
        $collection = Mage::getModel('elefunds/elefunds')->getCollection();
        $this->setCollection($collection);
        return parent::_prepareCollection();
    }

    protected function _prepareColumns() {
        $this->addColumn('id', array(
            'header'    => Mage::helper('elefunds')->__('ID'),
            'align'     => 'center',
            'width'     => '50px',
            'index'     => 'id',
        ));

        $this->addColumn('request_type', array(
            'header'    => Mage::helper('elefunds')->__('Request Type'),
            'width'     => '30px',
            'index'     => 'request_type',
        ));

        $this->addColumn('request', array(
            'header'    => Mage::helper('elefunds')->__('Request'),
            'width'     => '150px',
            'index'     => 'request',
        ));

        $this->addColumn('response', array(
            'header'    => Mage::helper('elefunds')->__('Response'),
            'width'     => '150px',
            'index'     => 'response',
        ));

        $this->addColumn('created_at', array(
            'header'    => Mage::helper('elefunds')->__('Created at'),
            'align'     => 'center',
            'width'     => '60px',
            'index'     => 'created_at',
            'type'      => 'datetime',
        ));

        return parent::_prepareColumns();
    }
}