#!/usr/bin/env python3
"""
Network Automation Engine for Unique Network BD
Handles MikroTik API, SNMP polling, and data collection
"""

import os
import sys
import json
import time
import logging
import subprocess
from datetime import datetime
from typing import Dict, List, Any, Optional
import threading
import queue

# Network libraries (install via pip)
try:
    import routeros_api
    from pysnmp.hlapi import *
    import requests
except ImportError as e:
    print(f"Missing dependencies: {e}")
    print("Run: pip install routeros-api pysnmp requests")
    sys.exit(1)

# ============================================================================
# Configuration
# ============================================================================

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

CONFIG_PATH = os.environ.get('CONFIG_PATH', 'data/config.json')
STATS_PATH = os.environ.get('STATS_PATH', 'data/network_stats.json')
GITHUB_TOKEN = os.environ.get('GITHUB_TOKEN')
GITHUB_REPO = os.environ.get('GITHUB_REPO')


# ============================================================================
# MikroTik API Client
# ============================================================================

class MikroTikClient:
    """MikroTik RouterOS API Client"""
    
    def __init__(self, host: str, username: str, password: str, port: int = 8728):
        self.host = host
        self.username = username
        self.password = password
        self.port = port
        self.connection = None
        self.api = None
        
    def connect(self) -> bool:
        """Establish connection to MikroTik router"""
        try:
            self.connection = routeros_api.RouterOsApiPool(
                self.host,
                username=self.username,
                password=self.password,
                port=self.port,
                use_ssl=False,
                plaintext_login=True
            )
            self.api = self.connection.get_api()
            logger.info(f"Connected to MikroTik at {self.host}")
            return True
        except Exception as e:
            logger.error(f"Failed to connect to MikroTik: {e}")
            return False
    
    def disconnect(self):
        """Close connection"""
        if self.connection:
            self.connection.disconnect()
    
    def get_system_resources(self) -> Dict[str, Any]:
        """Get CPU, RAM, and uptime information"""
        try:
            resources = self.api.get_resource('/system/resource')
            data = resources.get()[0]
            
            return {
                'cpu_load': float(data.get('cpu-load', 0)),
                'total_memory': int(data.get('total-memory', 0)),
                'free_memory': int(data.get('free-memory', 0)),
                'uptime': data.get('uptime', '0s'),
                'version': data.get('version', 'unknown')
            }
        except Exception as e:
            logger.error(f"Failed to get system resources: {e}")
            return {}
    
    def get_active_users(self) -> List[Dict[str, Any]]:
        """Get active PPPoE and Hotspot users"""
        users = []
        
        try:
            # Get PPPoE active connections
            ppp_active = self.api.get_resource('/ppp/active')
            for user in ppp_active.get():
                users.append({
                    'type': 'pppoe',
                    'username': user.get('name', 'unknown'),
                    'address': user.get('address', ''),
                    'uptime': user.get('uptime', '0s'),
                    'bytes-in': int(user.get('bytes-in', 0)),
                    'bytes-out': int(user.get('bytes-out', 0))
                })
            
            # Get Hotspot active users
            hotspot_active = self.api.get_resource('/ip/hotspot/active')
            for user in hotspot_active.get():
                users.append({
                    'type': 'hotspot',
                    'username': user.get('user', 'unknown'),
                    'address': user.get('address', ''),
                    'uptime': user.get('uptime', '0s'),
                    'bytes-in': int(user.get('bytes-in', 0)),
                    'bytes-out': int(user.get('bytes-out', 0))
                })
                
        except Exception as e:
            logger.error(f"Failed to get active users: {e}")
        
        return users
    
    def get_interface_traffic(self, interface: str = 'wan') -> Dict[str, Any]:
        """Get real-time traffic statistics for interface"""
        try:
            interfaces = self.api.get_resource('/interface')
            for iface in interfaces.get():
                if iface.get('name') == interface:
                    return {
                        'rx-rate': int(iface.get('rx-rate', 0)) / 1000000,  # Convert to Mbps
                        'tx-rate': int(iface.get('tx-rate', 0)) / 1000000,
                        'rx-byte': int(iface.get('rx-byte', 0)),
                        'tx-byte': int(iface.get('tx-byte', 0))
                    }
        except Exception as e:
            logger.error(f"Failed to get interface traffic: {e}")
        
        return {'rx-rate': 0, 'tx-rate': 0, 'rx-byte': 0, 'tx-byte': 0}


# ============================================================================
# OLT SNMP Monitor
# ============================================================================

class OLTMonitor:
    """BDCOM OLT SNMP Monitor"""
    
    def __init__(self, host: str, community: str, version: str = '2c'):
        self.host = host
        self.community = community
        self.version = version
        
        # SNMP OIDs for BDCOM OLT (adjust as needed)
        self.oids = {
            'onu_count': '1.3.6.1.4.1.3320.101.10.1.1.0',  # Total ONUs
            'onu_online': '1.3.6.1.4.1.3320.101.10.1.2.0',  # Online ONUs
            'onu_table': '1.3.6.1.4.1.3320.101.10.2.1',     # ONU table base
            'rx_power': '1.3.6.1.4.1.3320.101.10.2.1.5',    # RX Power OID
            'tx_power': '1.3.6.1.4.1.3320.101.10.2.1.6'     # TX Power OID
        }
    
    def get_snmp_data(self, oid: str) -> Any:
        """Perform SNMP GET request"""
        try:
            error_indication, error_status, error_index, var_binds = next(
                getCmd(
                    SnmpEngine(),
                    CommunityData(self.community, mpModel=1 if self.version == '2c' else 0),
                    UdpTransportTarget((self.host, 161)),
                    ContextData(),
                    ObjectType(ObjectIdentity(oid))
                )
            )
            
            if error_indication:
                logger.error(f"SNMP error: {error_indication}")
                return None
            elif error_status:
                logger.error(f"SNMP error status: {error_status}")
                return None
            
            for var_bind in var_binds:
                return var_bind[1]
                
        except Exception as e:
            logger.error(f"SNMP request failed: {e}")
            return None
    
    def get_onu_list(self) -> List[Dict[str, Any]]:
        """Get list of all ONUs with signal strengths"""
        onus = []
        
        try:
            # This is a simplified implementation
            # In production, you would walk the ONU table
            total_onus = self.get_snmp_data(self.oids['onu_count'])
            online_onus = self.get_snmp_data(self.oids['onu_online'])
            
            if total_onus:
                total = int(total_onus) if total_onus else 0
                online = int(online_onus) if online_onus else 0
                
                # For each ONU, get signal strengths
                for onu_id in range(1, total + 1):
                    rx_oid = f"{self.oids['rx_power']}.{onu_id}"
                    tx_oid = f"{self.oids['tx_power']}.{onu_id}"
                    
                    rx_power = self.get_snmp_data(rx_oid)
                    tx_power = self.get_snmp_data(tx_oid)
                    
                    if rx_power:
                        rx_power = int(rx_power) / 10  # Convert to dBm
                        tx_power = int(tx_power) / 10 if tx_power else 0
                        
                        status = 'online' if rx_power > -27 else 'warning'
                        quality = 'good' if rx_power > -20 else 'fair' if rx_power > -27 else 'poor'
                        
                        onus.append({
                            'id': onu_id,
                            'serial': f'BDCOM-{onu_id:03d}',
                            'rx_power': rx_power,
                            'tx_power': tx_power,
                            'status': status,
                            'quality': quality
                        })
            
            logger.info(f"Found {len(onus)} ONUs ({online} online)")
            return onus
            
        except Exception as e:
            logger.error(f"Failed to get ONU list: {e}")
            return []
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get OLT statistics"""
        try:
            total_onus = self.get_snmp_data(self.oids['onu_count'])
            online_onus = self.get_snmp_data(self.oids['onu_online'])
            
            total = int(total_onus) if total_onus else 0
            online = int(online_onus) if online_onus else 0
            
            # Get ONU list for warnings
            onus = self.get_onu_list()
            warnings = sum(1 for onu in onus if onu['rx_power'] < -27)
            
            return {
                'total_onus': total,
                'online_onus': online,
                'offline_onus': total - online,
                'signal_warnings': warnings,
                'onus': onus
            }
        except Exception as e:
            logger.error(f"Failed to get OLT statistics: {e}")
            return {}


# ============================================================================
# GitHub Integration
# ============================================================================

class GitHubStorage:
    """GitHub API client for storing network stats"""
    
    def __init__(self, token: str, repo: str):
        self.token = token
        self.repo = repo
        self.api_base = 'https://api.github.com'
    
    def update_stats(self, stats: Dict[str, Any]) -> bool:
        """Update network statistics on GitHub"""
        try:
            # Get current file info
            url = f"{self.api_base}/repos/{self.repo}/contents/{STATS_PATH}"
            headers = {
                'Authorization': f'token {self.token}',
                'Accept': 'application/vnd.github.v3+json'
            }
            
            # Add timestamp
            stats['timestamp'] = datetime.now().isoformat()
            content = json.dumps(stats, indent=2)
            content_base64 = base64.b64encode(content.encode()).decode()
            
            # Check if file exists
            response = requests.get(url, headers=headers)
            sha = None
            
            if response.status_code == 200:
                sha = response.json().get('sha')
            
            # Update file
            data = {
                'message': f'Update network stats - {datetime.now()}',
                'content': content_base64,
                'branch': 'main'
            }
            
            if sha:
                data['sha'] = sha
            
            response = requests.put(url, headers=headers, json=data)
            
            if response.status_code in [200, 201]:
                logger.info("Network stats updated on GitHub")
                return True
            else:
                logger.error(f"Failed to update GitHub: {response.status_code}")
                return False
                
        except Exception as e:
            logger.error(f"GitHub update failed: {e}")
            return False


# ============================================================================
# Main Monitoring Engine
# ============================================================================

class NetworkMonitor:
    """Main network monitoring engine"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.mikrotik = None
        self.olt = None
        self.github = None
        
        self.init_clients()
    
    def init_clients(self):
        """Initialize network clients"""
        # Initialize MikroTik
        mikrotik_config = self.config.get('mikrotik', {})
        if mikrotik_config:
            self.mikrotik = MikroTikClient(
                host=mikrotik_config.get('ip'),
                username=mikrotik_config.get('username'),
                password=mikrotik_config.get('password'),
                port=mikrotik_config.get('port', 8728)
            )
        
        # Initialize OLT
        olt_config = self.config.get('olt', {})
        if olt_config:
            self.olt = OLTMonitor(
                host=olt_config.get('ip'),
                community=olt_config.get('community'),
                version=olt_config.get('version', '2c')
            )
        
        # Initialize GitHub
        github_config = self.config.get('github', {})
        if github_config.get('token') and github_config.get('repo'):
            self.github = GitHubStorage(
                token=github_config['token'],
                repo=github_config['repo']
            )
    
    def collect_stats(self) -> Dict[str, Any]:
        """Collect all network statistics"""
        stats = {
            'timestamp': datetime.now().isoformat(),
            'mikrotik': {},
            'olt': {},
            'bandwidth': {}
        }
        
        # Collect MikroTik stats
        if self.mikrotik:
            try:
                if self.mikrotik.connect():
                    stats['mikrotik']['resources'] = self.mikrotik.get_system_resources()
                    stats['mikrotik']['users'] = self.mikrotik.get_active_users()
                    stats['bandwidth'] = self.mikrotik.get_interface_traffic('wan')
                    self.mikrotik.disconnect()
                else:
                    stats['mikrotik']['error'] = 'Connection failed'
            except Exception as e:
                logger.error(f"Error collecting MikroTik stats: {e}")
                stats['mikrotik']['error'] = str(e)
        
        # Collect OLT stats
        if self.olt:
            try:
                stats['olt'] = self.olt.get_statistics()
            except Exception as e:
                logger.error(f"Error collecting OLT stats: {e}")
                stats['olt']['error'] = str(e)
        
        return stats
    
    def save_stats(self, stats: Dict[str, Any]):
        """Save statistics to file and GitHub"""
        # Save locally
        try:
            os.makedirs(os.path.dirname(STATS_PATH), exist_ok=True)
            with open(STATS_PATH, 'w') as f:
                json.dump(stats, f, indent=2)
            logger.info(f"Stats saved locally to {STATS_PATH}")
        except Exception as e:
            logger.error(f"Failed to save local stats: {e}")
        
        # Upload to GitHub
        if self.github:
            self.github.update_stats(stats)
    
    def run_once(self):
        """Run a single collection cycle"""
        logger.info("Starting network statistics collection...")
        stats = self.collect_stats()
        self.save_stats(stats)
        logger.info("Collection cycle completed")
        
        # Print summary
        if stats.get('mikrotik', {}).get('resources'):
            cpu = stats['mikrotik']['resources'].get('cpu_load', 0)
            logger.info(f"MikroTik CPU: {cpu}%")
        
        if stats.get('olt', {}):
            total = stats['olt'].get('total_onus', 0)
            online = stats['olt'].get('online_onus', 0)
            warnings = stats['olt'].get('signal_warnings', 0)
            logger.info(f"OLT: {online}/{total} ONUs online, {warnings} signal warnings")
        
        if stats.get('bandwidth'):
            rx = stats['bandwidth'].get('rx-rate', 0)
            tx = stats['bandwidth'].get('tx-rate', 0)
            logger.info(f"Bandwidth: ↓{rx:.1f} Mbps ↑{tx:.1f} Mbps")
    
    def run_continuous(self, interval: int = 60):
        """Run continuous monitoring"""
        logger.info(f"Starting continuous monitoring (interval: {interval}s)")
        
        while True:
            try:
                self.run_once()
                time.sleep(interval)
            except KeyboardInterrupt:
                logger.info("Monitoring stopped by user")
                break
            except Exception as e:
                logger.error(f"Error in monitoring loop: {e}")
                time.sleep(interval)


# ============================================================================
# Main Entry Point
# ============================================================================

def load_config() -> Dict[str, Any]:
    """Load configuration from file"""
    try:
        if os.path.exists(CONFIG_PATH):
            with open(CONFIG_PATH, 'r') as f:
                return json.load(f)
        else:
            logger.warning(f"Config file not found: {CONFIG_PATH}")
            return {}
    except Exception as e:
        logger.error(f"Failed to load config: {e}")
        return {}

def main():
    """Main function"""
    import base64
    
    config = load_config()
    
    if not config:
        logger.error("No configuration found. Please configure the system first.")
        return
    
    monitor = NetworkMonitor(config)
    
    # Check if running in GitHub Actions (single run)
    if os.environ.get('GITHUB_ACTIONS') == 'true':
        monitor.run_once()
    else:
        # Continuous monitoring
        interval = int(os.environ.get('MONITOR_INTERVAL', 60))
        monitor.run_continuous(interval)

if __name__ == "__main__":
    main()
